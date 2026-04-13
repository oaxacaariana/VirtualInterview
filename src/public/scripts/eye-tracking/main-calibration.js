// const eyeTrackingSpot = document.getElementById('eye-tracking-spot');
async function startCalibration() {

    //start the webgazer tracker
    await webgazer.setRegression('ridge') // currently must set regression and tracker
        //.setTracker('clmtrackr')
        .setGazeListener(function (data, clock) {
            //   console.log(data); // data is an object containing an x and y key which are the x and y prediction coordinates (no bounds limiting)
            //   console.log(clock); // elapsed time in milliseconds since webgazer.begin() was called
            if (isCalibrated) {
                total++;
                if (isOverlap(data.x, data.y)) {
                    count++;
                    eyeTrackingSpot.style.border = "5px, solid, green";
                }
                else {
                    eyeTrackingSpot.style.border = "5px, solid, red";

                }
            }
        })
        .saveDataAcrossSessions(true)
        .begin();
    webgazer.showVideoPreview(false) // shows all video previews
        .showPredictionPoints(true) // shows a square every 100 milliseconds where current prediction is
        .applyKalmanFilter(true) // Kalman Filter defaults to on. Can be toggled by user.
        .showFaceOverlay(false)
        .showFaceFeedbackBox(false);

    //Set up the webgazer video feedback.
    var setup = function () {
        //Set up the main canvas. The main canvas is used to calibrate the webgazer.
        var canvas = document.getElementById("plotting_canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.visibility = "visible";
        console.log('canvas is visible');
    };
    setup();
};

// Set to true if you want to save the data even if you reload the page.
window.saveDataAcrossSessions = true;

window.onbeforeunload = function () {
    webgazer.end();
}

/**
 * Restart the calibration process by clearing the local storage and reseting the calibration point
 */
function Restart() {
    webgazer.clearData();
    webgazer.end();
    isCalibrated = false;
    ClearCalibration();
    PopUpInstruction();
}