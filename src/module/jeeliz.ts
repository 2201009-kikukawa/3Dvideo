const faceTransferAPI = require("../jeeliz/jeelizFaceExpressions.module.js");
const neuralNetworkModel = require('../jeeliz/jeelizFaceExpressionsNNC.json');

const jeelizCanvas: HTMLCanvasElement = document.createElement("canvas");
jeelizCanvas.id = "jeelizCanvas";
document.body.appendChild(jeelizCanvas).style.display = "none";

let faceDetectionStatus = 'not_detected'; 
const onStatusChange = (newStatus) => {
    faceDetectionStatus = newStatus;
    console.log('Face Detection Status:', newStatus);
};

faceTransferAPI.init({
    canvasId: "jeelizCanvas",
    NNC: neuralNetworkModel,
    callbackReady: (errCode: any) => {
        if (errCode) {
            console.log('AN ERROR HAPPENS. ERROR CODE =', errCode);
            onStatusChange('error');
            return;
        }
        console.log("Jeeliz is Ready");
        onStatusChange('ready');
    },
    callbackTrack: (detectState) => {
        if (detectState.detected) {
            onStatusChange('detected');
            // デバッグ情報の出力
            console.log('Face rotation:', detectState.rx, detectState.ry, detectState.rz);
            console.log('Face expressions:', detectState.expressions);
            console.log('Blink:', detectState.blink);
        } else {
            onStatusChange('not_detected');
        }
    }
});

faceTransferAPI.switch_displayVideo(false);

export { faceTransferAPI, faceDetectionStatus };