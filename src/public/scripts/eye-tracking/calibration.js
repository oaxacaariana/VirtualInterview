const cameraBtn = document.getElementById('camera-btn');
const videoFeedEl = document.getElementById('video-feed');
const cameraContainer = document.querySelector('.camera-container');
const recalibrateBtn = document.getElementById('recalibrate-btn');

var eyeTrackingSpot = document.getElementById('eye-tracking-spot');
var isCalibrated = false;
var total = 0;
var count = 0;
var PointCalibrate = 0;
var CalibrationPoints = {};

// Turns the camera on
async function startCamera() {
  console.log('Starting camera');
  // Set the video's stream to the user's camera
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });

  videoFeedEl.srcObject = stream;
  cameraContainer.classList.add('active');
}

// Turns the camera off
function stopCamera() {
  console.log('Stopping Camera');
  // If there are no video tracks return
  if (!videoFeedEl.srcObject) { return; }
  else {
    // Remove the track from the stream and set the video's source to null
    videoFeedEl.srcObject.getTracks().forEach(track => track.stop());
    videoFeedEl.srcObject = null;
    cameraContainer.classList.remove('active');
  }
}

// Toggles the camera and eye tracker
cameraBtn.addEventListener('click', () => {
  if (videoFeedEl.srcObject) {
    if (isCalibrated) {
      webgazer.showPredictionPoints(false).pause(); // Pause the eye tracker
      console.log('accuracy: ' + (count / total) * 100 + '%');
      count = 0;
      total = 0;
    }
    stopCamera(); // Turn the camera off
  }
  else {
    if (!isCalibrated) {
      alertEyeTracking(); // Begin eye tracker calibration sequence
    }
    else {
      webgazer.showPredictionPoints(true).resume(); // Resume the eye tracker
    }
    startCamera(); // Turn the camera on
  }
});

// Clear the canvas and the calibration button.
function ClearCanvas() {
  document.querySelectorAll('.Calibration').forEach((i) => {
    i.style.setProperty('display', 'none');
  });
  var canvas = document.getElementById("plotting_canvas");
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function CloseCanvas() {
  var canvas = document.getElementById("plotting_canvas");
  canvas.style.visibility = "hidden";
}

// Pop up asking if the user wants to include eye tracking in their interview
function alertEyeTracking() {
  Swal.fire({
    title: "Track Eye Movement",
    text: "Would you like to track eye movement during your interview to receive feedback on your eye contact?",
    showCancelButton: true,
    showConfirmButton: true,
    cancelButtonText: "No",
    confirmButtonText: "Yes",
    background: 'linear-gradient(180deg, rgba(20,23,32,0.96), rgba(15,15,16,0.98))',
    color: '#dbeafe',
    titleColor: '#93c5fd',
    customClass: {
      confirmButton: 'swal-btn-confirm',
      cancelButton: 'swal-btn-cancel'
    },
    buttonsStyling: false
  }).then((result) => {
    if (result.isConfirmed) { // Clicked "Yes"
      // User wants feedback on eye tracking. Begin calibration
      PopUpInstruction();
    }
    else { // Clicked "No"
      // User does not want feedback on eye tracking. Just show the camera
      return;
    }
  });
}

// Show the instruction of using calibration at the start up screen.
function PopUpInstruction() {
  ClearCanvas();
  Swal.fire({
    title: "Calculating measurement",
    text: "Please click on each of the 9 points on the screen. You must click on each point 5 times until it goes yellow. This will calibrate your eye movements.",
    background: 'linear-gradient(180deg, rgba(20,23,32,0.96), rgba(15,15,16,0.98))',
    color: '#dbeafe',
    titleColor: '#93c5fd',
    showConfirmButton: true,
    confirmButtonText: 'OK',
    buttonsStyling: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: {
      confirmButton: 'swal-btn-confirm'
    }
  }).then(isConfirm => {
    ShowCalibrationPoint(); // Load the red dots
    startCalibration(); // begin calibration
  });

}

function calcAccuracy() {
  // notification for the measurement process
  Swal.fire({
    title: "Calculating measurement",
    text: "Please don't move your mouse & stare at the middle dot for the next 5 seconds. This will allow us to calculate the accuracy of our predictions.",
    background: 'linear-gradient(180deg, rgba(20,23,32,0.96), rgba(15,15,16,0.98))',
    color: '#dbeafe',
    titleColor: '#93c5fd',
    showConfirmButton: true,
    confirmButtonText: 'OK',
    buttonsStyling: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: {
      confirmButton: 'swal-btn-confirm'
    }
  }).then(() => {
    // makes the variables true for 5 seconds & plots the points

    store_points_variable(); // start storing the prediction points

    sleep(5000).then(() => {
      stop_storing_points_variable(); // stop storing the prediction points
      var past50 = webgazer.getStoredPoints(); // retrieve the stored points
      var precision_measurement = calculatePrecision(past50);
      calculateAverageSpot(past50)
      Swal.fire({
        title: "Your accuracy measure is " + precision_measurement + "%",
        text: "You can choose to recalibrate if you want.",
        background: 'linear-gradient(180deg, rgba(20,23,32,0.96), rgba(15,15,16,0.98))',
        color: '#dbeafe',
        titleColor: '#93c5fd',
        showCancelButton: true,
        confirmButtonText: 'Continue',
        cancelButtonText: 'Recalibrate',
        buttonsStyling: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          confirmButton: 'swal-btn-confirm',
          cancelButton: 'swal-btn-cancel'
        }
      }).then((result) => {
        if (result.isConfirmed) { // Clicked "Continue"
          //clear the calibration & hide the last middle button
          ClearCanvas();
          CloseCanvas();
          isCalibrated = true;
          recalibrateBtn.style.visibility = "visible";
        } else { // CLicked "Recalibrate"
          //use restart function to restart the calibration
          Restart();
        }
      });
    });
  });
}

function calPointClick(node) {
  const id = node.id;

  if (!CalibrationPoints[id]) { // initialises if not done
    CalibrationPoints[id] = 0;
  }
  CalibrationPoints[id]++; // increments values

  if (CalibrationPoints[id] == 5) { //only turn to yellow after 5 clicks
    node.style.setProperty('background-color', 'yellow');
    node.setAttribute('disabled', 'disabled');
    PointCalibrate++;
  } else if (CalibrationPoints[id] < 5) {
    //Gradually increase the opacity of calibration points when click to give some indication to user.
    var opacity = 0.2 * CalibrationPoints[id] + 0.2;
    node.style.setProperty('opacity', opacity);
  }

  //Show the middle calibration point after all other points have been clicked.
  if (PointCalibrate == 8) {
    document.getElementById('Pt5').style.removeProperty('display');
  }

  if (PointCalibrate >= 9) { // last point is calibrated
    // grab every element in Calibration class and hide them except the middle point.
    document.querySelectorAll('.Calibration').forEach((i) => {
      i.style.setProperty('display', 'none');
    });
    document.getElementById('Pt5').style.removeProperty('display');

    // clears the canvas
    var canvas = document.getElementById("plotting_canvas");
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    // Calculate the accuracy
    calcAccuracy();
  }
}

/**
 * Load this function when the index page starts.
* This function listens for button clicks on the html page
* checks that all buttons have been clicked 5 times each, and then goes on to measuring the precision
*/
//$(document).ready(function(){
function docLoad() {
  ClearCanvas();

  // click event on the calibration buttons
  document.querySelectorAll('.Calibration').forEach((i) => {
    i.addEventListener('click', () => {
      calPointClick(i);
    })
  })
};
window.addEventListener('load', docLoad);

/**
 * Show the Calibration Points
 */
function ShowCalibrationPoint() {
  document.querySelectorAll('.Calibration').forEach((i) => {
    i.style.removeProperty('display');
  });
  // initially hides the middle button
  document.getElementById('Pt5').style.setProperty('display', 'none');
}

/**
* This function clears the calibration buttons memory
*/
function ClearCalibration() {
  // Clear data from WebGazer

  document.querySelectorAll('.Calibration').forEach((i) => {
    i.style.setProperty('background-color', 'red');
    i.style.setProperty('opacity', '0.2');
    i.removeAttribute('disabled');
  });

  CalibrationPoints = {};
  PointCalibrate = 0;
}

// Checks whether the eye tracker is on the interviewer
function isOverlap(xPos, yPos) {
  const rect = eyeTrackingSpot.getBoundingClientRect();
  return (
    xPos >= rect.left &&
    xPos <= rect.right &&
    yPos >= rect.top &&
    yPos <= rect.bottom
  );
}

// sleep function because java doesn't have one, sourced from http://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
