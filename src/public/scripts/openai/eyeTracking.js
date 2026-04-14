const SCREEN_MARGIN_PX = 80;
const STALE_GAZE_MS = 1500;
const OFFSCREEN_CONFIRM_MS = 900;
const ONSCREEN_CONFIRM_MS = 350;
const CALIBRATION_CLICKS_REQUIRED = 5;

export const createEyeTracking = ({
  cameraFeed,
  cameraPlaceholder,
  stageLiveBadge,
  eyeTrackingSpot,
  cameraToggleBtn,
  recalibrateBtn,
  calibrationOverlay,
  calibrationCancelBtn,
  calibrationPoints = [],
  shouldMeasure = () => false,
  onMetricChange = () => {},
}) => {
  let cameraStream = null;
  let cameraEnabled = localStorage.getItem('iv-camera') !== 'off';
  let eyeTrackingEnabled = localStorage.getItem('iv-eye-tracking') !== 'off';
  let webgazerInitialized = false;
  let calibrationActive = false;
  let calibrationComplete = localStorage.getItem('iv-eye-tracking-calibrated') === 'true';
  let calibrationRestoreState = calibrationComplete;
  let engagementWindowActive = false;
  let engagementStatus = 'unknown';
  let pendingEngagementStatus = null;
  let pendingEngagementSince = 0;
  let lastEngagementTickAt = performance.now();
  let lastGazeSampleAt = 0;
  let heartbeatTimer = null;
  const calibrationProgress = {};

  const screenEngagementMetrics = {
    onScreenMs: 0,
    offScreenMs: 0,
    unknownMs: 0,
  };

  const setEyeTrackingState = (active, status = null) => {
    if (!eyeTrackingSpot) return;
    eyeTrackingSpot.classList.toggle('is-active', active);
    eyeTrackingSpot.classList.toggle('is-focused', status === 'on');
    eyeTrackingSpot.classList.toggle('is-missed', status === 'off');
  };

  const isWithinScreenBounds = (xPos, yPos) => {
    if (!Number.isFinite(xPos) || !Number.isFinite(yPos)) {
      return false;
    }

    return (
      xPos >= -SCREEN_MARGIN_PX &&
      xPos <= window.innerWidth + SCREEN_MARGIN_PX &&
      yPos >= -SCREEN_MARGIN_PX &&
      yPos <= window.innerHeight + SCREEN_MARGIN_PX
    );
  };

  const buildMetric = () => {
    const trackedMs = screenEngagementMetrics.onScreenMs + screenEngagementMetrics.offScreenMs;
    const scorePct = trackedMs
      ? Math.round((screenEngagementMetrics.onScreenMs / trackedMs) * 100)
      : null;

    let statusLabel = 'Idle';
    if (calibrationActive) {
      statusLabel = 'Calibrating';
    } else if (!cameraStream) {
      statusLabel = 'Camera off';
    } else if (!eyeTrackingEnabled) {
      statusLabel = 'Tracking off';
    } else if (!engagementWindowActive) {
      statusLabel = 'Paused';
    } else if (engagementStatus === 'on') {
      statusLabel = 'On-screen';
    } else if (engagementStatus === 'off') {
      statusLabel = 'Off-screen';
    } else {
      statusLabel = 'Unknown';
    }

    return {
      enabled: !!(cameraStream && eyeTrackingEnabled),
      calibrated: calibrationComplete,
      calibrationActive,
      status: calibrationActive
        ? 'calibrating'
        : !cameraStream
          ? 'camera-off'
          : !eyeTrackingEnabled
            ? 'tracking-off'
            : !engagementWindowActive
              ? 'paused'
              : engagementStatus,
      statusLabel,
      scorePct,
      onScreenMs: screenEngagementMetrics.onScreenMs,
      offScreenMs: screenEngagementMetrics.offScreenMs,
      unknownMs: screenEngagementMetrics.unknownMs,
    };
  };

  const updateEyeTrackingBadge = () => {
    if (!stageLiveBadge) return;
    if (!cameraStream) {
      stageLiveBadge.removeAttribute('data-engagement-score');
      return;
    }

    const metric = buildMetric();
    const badgeText = metric.calibrationActive
      ? 'calibrating'
      : typeof metric.scorePct === 'number'
        ? `${metric.scorePct}% on-screen`
        : metric.enabled
          ? metric.calibrated
            ? 'tracking'
            : 'calibrate'
          : '';

    if (!badgeText) {
      stageLiveBadge.removeAttribute('data-engagement-score');
      return;
    }

    stageLiveBadge.setAttribute('data-engagement-score', badgeText);
  };

  const updateCalibrationButton = () => {
    if (!recalibrateBtn) return;
    recalibrateBtn.disabled = !cameraStream || !eyeTrackingEnabled || calibrationActive;
    recalibrateBtn.title = !cameraStream
      ? 'Turn camera on first'
      : !eyeTrackingEnabled
        ? 'Enable eye tracking first'
        : calibrationActive
          ? 'Calibration in progress'
          : 'Calibrate eye tracking';
    recalibrateBtn.classList.toggle('is-active', calibrationComplete && !calibrationActive);
    recalibrateBtn.textContent = calibrationComplete ? 'Recalibrate' : 'Calibrate';
  };

  const publishMetric = () => {
    updateEyeTrackingBadge();
    updateCalibrationButton();
    onMetricChange(buildMetric());
  };

  const commitScreenEngagementTime = (now = performance.now()) => {
    const delta = Math.max(0, now - lastEngagementTickAt);
    lastEngagementTickAt = now;

    if (!engagementWindowActive || delta <= 0) {
      return;
    }

    if (engagementStatus === 'on') {
      screenEngagementMetrics.onScreenMs += delta;
      return;
    }

    if (engagementStatus === 'off') {
      screenEngagementMetrics.offScreenMs += delta;
      return;
    }

    screenEngagementMetrics.unknownMs += delta;
  };

  const applyEngagementStatus = (nextStatus, now = performance.now()) => {
    commitScreenEngagementTime(now);
    engagementStatus = nextStatus;
    pendingEngagementStatus = null;
    pendingEngagementSince = 0;
    setEyeTrackingState(!!(cameraStream && eyeTrackingEnabled), nextStatus);
    updateEyeTrackingBadge();
  };

  const queueEngagementStatus = (nextStatus, now = performance.now()) => {
    if (!engagementWindowActive) {
      return;
    }

    if (nextStatus === 'unknown') {
      if (engagementStatus !== 'unknown') {
        applyEngagementStatus('unknown', now);
      }
      return;
    }

    if (engagementStatus === nextStatus) {
      pendingEngagementStatus = null;
      pendingEngagementSince = 0;
      setEyeTrackingState(true, nextStatus);
      return;
    }

    if (pendingEngagementStatus !== nextStatus) {
      pendingEngagementStatus = nextStatus;
      pendingEngagementSince = now;
      return;
    }

    const threshold = nextStatus === 'off' ? OFFSCREEN_CONFIRM_MS : ONSCREEN_CONFIRM_MS;
    if (now - pendingEngagementSince >= threshold) {
      applyEngagementStatus(nextStatus, now);
    }
  };

  const resetMetric = () => {
    screenEngagementMetrics.onScreenMs = 0;
    screenEngagementMetrics.offScreenMs = 0;
    screenEngagementMetrics.unknownMs = 0;
    engagementStatus = 'unknown';
    pendingEngagementStatus = null;
    pendingEngagementSince = 0;
    lastGazeSampleAt = 0;
    lastEngagementTickAt = performance.now();
    publishMetric();
  };

  const pauseEyeTracking = () => {
    commitScreenEngagementTime();
    engagementWindowActive = false;
    engagementStatus = 'unknown';
    pendingEngagementStatus = null;
    pendingEngagementSince = 0;
    setEyeTrackingState(false);
    if (!window.webgazer || !webgazerInitialized) {
      publishMetric();
      return;
    }

    try {
      window.webgazer.pause();
    } catch {
      // no-op
    }

    publishMetric();
  };

  const startEyeTracking = async () => {
    if (!window.webgazer || !eyeTrackingEnabled) {
      return;
    }

    try {
      if (!webgazerInitialized) {
        window.webgazer.params.faceMeshBasePath = '/mediapipe/face_mesh/';
        await window.webgazer
          .setRegression('ridge')
          .setGazeListener((data) => {
            if (!cameraStream) return;

            const now = performance.now();
            lastGazeSampleAt = now;

            if (!data) {
              queueEngagementStatus('off', now);
              publishMetric();
              return;
            }

            const nextStatus = isWithinScreenBounds(data.x, data.y) ? 'on' : 'off';
            queueEngagementStatus(nextStatus, now);
            publishMetric();
          })
          .saveDataAcrossSessions(true)
          .begin();

        window.webgazer
          .showVideoPreview(false)
          .showPredictionPoints(false)
          .applyKalmanFilter(true)
          .showFaceOverlay(false)
          .showFaceFeedbackBox(false);

        webgazerInitialized = true;
      } else {
        await window.webgazer.resume();
      }

      setEyeTrackingState(true, engagementStatus);
      publishMetric();
    } catch (error) {
      console.warn('Eye tracking failed to start:', error);
      eyeTrackingEnabled = false;
      localStorage.setItem('iv-eye-tracking', 'off');
      setEyeTrackingState(false);
      publishMetric();
    }
  };

  const setCameraUI = (on) => {
    if (cameraFeed) cameraFeed.classList.toggle('hidden', !on);
    if (cameraPlaceholder) cameraPlaceholder.classList.toggle('hidden', on);
    if (stageLiveBadge) stageLiveBadge.style.display = on ? '' : 'none';
    if (cameraToggleBtn) {
      cameraToggleBtn.classList.toggle('is-active', on);
      cameraToggleBtn.title = on ? 'Turn camera off' : 'Turn camera on';
    }
    if (!on) {
      setEyeTrackingState(false);
    }
    publishMetric();
  };

  const promptForEyeTracking = async () => {
    if (!window.webgazer) {
      return false;
    }

    const cachedChoice = sessionStorage.getItem('iv-eye-tracking-choice');
    if (cachedChoice) {
      return cachedChoice === 'yes';
    }

    const savedChoice = localStorage.getItem('iv-eye-tracking');
    if (savedChoice === 'yes' || savedChoice === 'on') {
      sessionStorage.setItem('iv-eye-tracking-choice', 'yes');
      return true;
    }
    if (savedChoice === 'no' || savedChoice === 'off') {
      sessionStorage.setItem('iv-eye-tracking-choice', 'no');
      return false;
    }

    if (window.Swal?.fire) {
      const result = await window.Swal.fire({
        title: 'Track Screen Engagement',
        text: 'Would you like to track whether your gaze stays on-screen during your answers?',
        showCancelButton: true,
        showConfirmButton: true,
        cancelButtonText: 'No',
        confirmButtonText: 'Yes',
        background: 'linear-gradient(180deg, rgba(20,23,32,0.96), rgba(15,15,16,0.98))',
        color: '#dbeafe',
        titleColor: '#93c5fd',
        customClass: {
          confirmButton: 'swal-btn-confirm',
          cancelButton: 'swal-btn-cancel',
        },
        buttonsStyling: false,
      });

      sessionStorage.setItem('iv-eye-tracking-choice', result.isConfirmed ? 'yes' : 'no');
      return result.isConfirmed;
    }

    const accepted = window.confirm('Track whether your gaze stays on-screen during your answers?');
    sessionStorage.setItem('iv-eye-tracking-choice', accepted ? 'yes' : 'no');
    return accepted;
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    if (cameraFeed) {
      cameraFeed.srcObject = null;
    }
    pauseEyeTracking();
    setCameraUI(false);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraUI(false);
      return;
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (cameraFeed) {
        cameraFeed.srcObject = cameraStream;
      }
      setCameraUI(true);

      const shouldTrackEyes = await promptForEyeTracking();
      eyeTrackingEnabled = shouldTrackEyes;
      localStorage.setItem('iv-eye-tracking', shouldTrackEyes ? 'on' : 'off');

      if (shouldTrackEyes) {
        await startEyeTracking();
      } else {
        setEyeTrackingState(false);
        publishMetric();
      }

      syncMeasurementWindow();
    } catch (error) {
      console.warn('Camera failed to start:', error);
      setCameraUI(false);
      syncMeasurementWindow();
    }
  };

  const hideCalibrationOverlay = ({ restorePreviousCalibration = false } = {}) => {
    if (restorePreviousCalibration) {
      calibrationComplete = calibrationRestoreState;
      localStorage.setItem('iv-eye-tracking-calibrated', calibrationComplete ? 'true' : 'false');
    }
    calibrationActive = false;
    calibrationOverlay?.classList.add('hidden');
    calibrationOverlay?.setAttribute('aria-hidden', 'true');
    try {
      window.webgazer?.showPredictionPoints(false);
    } catch {
      // no-op
    }
    publishMetric();
    syncMeasurementWindow();
  };

  const resetCalibrationOverlay = () => {
    calibrationPoints.forEach((point) => {
      calibrationProgress[point.dataset.point] = 0;
      point.disabled = false;
      point.classList.remove('is-complete');
      point.style.removeProperty('--calibration-progress');
    });
  };

  const finishCalibration = () => {
    calibrationComplete = true;
    calibrationRestoreState = true;
    localStorage.setItem('iv-eye-tracking-calibrated', 'true');
    hideCalibrationOverlay();
    if (window.Swal?.fire) {
      void window.Swal.fire({
        title: 'Calibration saved',
        text: 'Eye tracking has been recalibrated for this browser.',
        background: 'linear-gradient(180deg, rgba(20,23,32,0.96), rgba(15,15,16,0.98))',
        color: '#dbeafe',
        titleColor: '#93c5fd',
        confirmButtonText: 'Continue',
        buttonsStyling: false,
        customClass: {
          confirmButton: 'swal-btn-confirm',
        },
      });
    }
    publishMetric();
  };

  const openCalibration = async () => {
    if (!cameraEnabled || !cameraStream) {
      if (window.Swal?.fire) {
        await window.Swal.fire({
          title: 'Camera required',
          text: 'Turn the camera on before calibrating eye tracking.',
          background: 'linear-gradient(180deg, rgba(20,23,32,0.96), rgba(15,15,16,0.98))',
          color: '#dbeafe',
          titleColor: '#93c5fd',
          confirmButtonText: 'OK',
          buttonsStyling: false,
          customClass: {
            confirmButton: 'swal-btn-confirm',
          },
        });
      }
      return;
    }

    if (!eyeTrackingEnabled || !window.webgazer) {
      return;
    }

    calibrationRestoreState = calibrationComplete;
    calibrationActive = true;
    calibrationComplete = false;
    localStorage.setItem('iv-eye-tracking-calibrated', 'false');
    resetCalibrationOverlay();

    try {
      await window.webgazer?.clearData?.();
      await startEyeTracking();
      window.webgazer?.showPredictionPoints(true);
    } catch (error) {
      console.warn('Calibration setup failed:', error);
    }

    calibrationOverlay?.classList.remove('hidden');
    calibrationOverlay?.setAttribute('aria-hidden', 'false');
    syncMeasurementWindow();
  };

  const handleCameraToggle = async () => {
    cameraEnabled = !cameraEnabled;
    localStorage.setItem('iv-camera', cameraEnabled ? 'on' : 'off');
    if (cameraEnabled) {
      await startCamera();
    } else {
      stopCamera();
      syncMeasurementWindow();
    }
  };

  const handleCalibrationCancel = () => {
    hideCalibrationOverlay({ restorePreviousCalibration: true });
  };

  const handleRecalibrate = () => {
    void openCalibration();
  };

  const handleBeforeUnload = () => {
    stopCamera();
    if (window.webgazer && webgazerInitialized) {
      try {
        window.webgazer.end();
      } catch {
        // no-op
      }
    }
  };

  const syncMeasurementWindow = () => {
    const now = performance.now();
    commitScreenEngagementTime(now);
    const nextWindowActive =
      !calibrationActive &&
      !!cameraStream &&
      eyeTrackingEnabled &&
      Boolean(shouldMeasure());

    if (engagementWindowActive !== nextWindowActive) {
      engagementWindowActive = nextWindowActive;
      pendingEngagementStatus = null;
      pendingEngagementSince = 0;
      if (!engagementWindowActive) {
        engagementStatus = 'unknown';
        setEyeTrackingState(!!(cameraStream && eyeTrackingEnabled), null);
      }
    }

    publishMetric();
  };

  calibrationPoints.forEach((point) => {
    point.addEventListener('click', () => {
      if (!calibrationActive) return;

      const pointId = point.dataset.point;
      const nextCount = Math.min(
        CALIBRATION_CLICKS_REQUIRED,
        (calibrationProgress[pointId] || 0) + 1
      );
      calibrationProgress[pointId] = nextCount;
      point.style.setProperty('--calibration-progress', `${(nextCount / CALIBRATION_CLICKS_REQUIRED) * 100}%`);

      if (nextCount >= CALIBRATION_CLICKS_REQUIRED) {
        point.disabled = true;
        point.classList.add('is-complete');
      }

      const allPointsDone = calibrationPoints.every(
        (candidate) => (calibrationProgress[candidate.dataset.point] || 0) >= CALIBRATION_CLICKS_REQUIRED
      );

      if (allPointsDone) {
        finishCalibration();
      }
    });
  });

  cameraToggleBtn?.addEventListener('click', handleCameraToggle);
  recalibrateBtn?.addEventListener('click', handleRecalibrate);
  calibrationCancelBtn?.addEventListener('click', handleCalibrationCancel);
  window.addEventListener('beforeunload', handleBeforeUnload);

  const init = () => {
    if (heartbeatTimer !== null) {
      return;
    }

    heartbeatTimer = window.setInterval(() => {
      const now = performance.now();
      commitScreenEngagementTime(now);

      if (engagementWindowActive && lastGazeSampleAt && now - lastGazeSampleAt > STALE_GAZE_MS) {
        applyEngagementStatus('off', now);
      }

      publishMetric();
    }, 300);

    if (cameraEnabled) {
      void startCamera();
    } else {
      setCameraUI(false);
    }

    publishMetric();
  };

  const destroy = () => {
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    cameraToggleBtn?.removeEventListener('click', handleCameraToggle);
    recalibrateBtn?.removeEventListener('click', handleRecalibrate);
    calibrationCancelBtn?.removeEventListener('click', handleCalibrationCancel);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    handleBeforeUnload();
  };

  return {
    init,
    destroy,
    getMetric: buildMetric,
    resetMetric,
    syncMeasurementWindow,
  };
};
