
const cameraBtn = document.getElementById('camera-btn');
const videoFeedEl = document.getElementById('video-feed');
const smileyFace = document.getElementById('smiley-face');
const cameraContainer = document.querySelector('.camera-container');

let webgazerInitialized = false;
// let total = 0;
// let count = 0;

const calibrateContainer = document.querySelector('.calibrate-container');
const calibrateBtn = document.getElementById('calibrate-btn');
const calibrateClose = document.getElementById('calibrate-close');
// let isCalibrated = false;

// Turns the camera on and begins eye detection
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

// Turns the camera video tracks off and pauses eye tracking
function stopCamera() {
    console.log('Stopping Camera');

    // If there are no video tracks
    if (!videoFeedEl.srcObject) { return; }
    else {
        // Remove the track from the stream and set the video's source to null
        videoFeedEl.srcObject.getTracks().forEach(track => track.stop());
        videoFeedEl.srcObject = null;
        cameraContainer.classList.remove('active');
    }
}


// Toggles the camera
cameraBtn.addEventListener('click', () => {
    if (videoFeedEl.srcObject) {
        if (webgazer.isCalibrated) {
            webgazer.end();
        }
        stopCamera();
    }
    else {
        if (!isCalibrated) {
            alertEyeTracking();
        }
        startCamera();
    }
});




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
        if (result.isConfirmed) {
            // User wants feedback on eye tracking. Begin calibration
            PopUpInstruction();
        }
        else {
            // User does not want feedback on eye tracking. Just show the camera
        }
    });
}






// Checks whether the eye tracker is on the interviewer
function isOverlap(xPos, yPos) {
    const rect = smileyFace.getBoundingClientRect();
    return (
        xPos >= rect.left &&
        xPos <= rect.right &&
        yPos >= rect.top &&
        yPos <= rect.bottom
    );
}