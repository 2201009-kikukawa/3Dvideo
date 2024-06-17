import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import { faceTransferAPI } from './jeeliz';

const scene = new THREE.Scene();
const canvas = document.getElementById('avatar-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

scene.background = new THREE.Color(0x00ff00);
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(1, 1, -1);
scene.add(directionalLight);

const loader = new GLTFLoader();
loader.register((parser) => {
    return new VRMLoaderPlugin(parser);
});

let head: THREE.Object3D;
let neck: THREE.Object3D;
let spine: THREE.Object3D;
let modelLoaded = false;
let currentVRM; // 現在のVRMモデルを保持する変数

const fileInput = document.getElementById('rvmFileInput') as HTMLInputElement;
fileInput.addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const url = URL.createObjectURL(file);

    loadVRMModel(url);
});

function loadVRMModel(url: string) {
    loader.load(
        url,
        (gltf) => {
            const vrm = gltf.userData.vrm;
            vrm.scene.rotation.y = Math.PI;
            
            vrm.humanoid.getRawBoneNode('leftUpperArm').rotation.z = Math.PI / 3;
            vrm.humanoid.getRawBoneNode('rightUpperArm').rotation.z = -Math.PI / 3;
            vrm.humanoid.getRawBoneNode('leftLowerArm').rotation.x = 0;
            vrm.humanoid.getRawBoneNode('rightLowerArm').rotation.x = 0;
            
            scene.add(vrm.scene);

            modelLoaded = true;
            currentVRM = vrm;

            head = vrm.humanoid.getRawBoneNode("head");
            neck = vrm.humanoid.getRawBoneNode("neck");
            spine = vrm.humanoid.getRawBoneNode("spine");

            const eyePosition = vrm.humanoid.getNormalizedBoneNode("rightEye").getWorldPosition(new THREE.Vector3());
            const distance = 0.5;
            const cameraPosition = eyePosition.clone().add(new THREE.Vector3(0, 0, distance));
            camera.position.copy(cameraPosition);
            camera.lookAt(eyePosition);

            faceTransferAPI.switch_displayVideo(false);
        },
        (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
        (error) => console.error(error)
    );
}

const update = () => {
    if (modelLoaded) {
        if (faceTransferAPI.ready && faceTransferAPI.is_detected()) {
            const faceExpression = faceTransferAPI.get_morphTargetInfluencesStabilized();
            const rawExpressions = convertExpression(faceExpression);
            const filteredExpressions = applyThreshold(rawExpressions);
            applyExpression(filteredExpressions);
        }

        if (faceTransferAPI.ready && faceTransferAPI.is_detected()) {
            const faceRotation = faceTransferAPI.get_rotationStabilized();
            updateFaceRotation(faceRotation);
        }
    }

    requestAnimationFrame(update);
    renderer.render(scene, camera);
};
update();

interface FaceBlendshape {
    [s: string]: number;
}

function convertExpression(faceExpression: any): FaceBlendshape {
    const rawExpressions: FaceBlendshape = {
        "blink_r": faceExpression[9] || 0,
        "blink_l": faceExpression[8] || 0,
        "aa": faceExpression[6] || 0,
        "ih": faceExpression[10] || 0,
        "ou": faceExpression[7] || 0,
        "oh": (faceExpression[6] + faceExpression[6] * faceExpression[7]) * 0.5 || 0,
        "angry": faceExpression[11] || 0,
        "happy": faceExpression[12] || 0,
        "lookDown": faceExpression[13] || 0,
        "lookLeft": faceExpression[14] || 0,
        "lookRight": faceExpression[15] || 0,
        "lookUp": faceExpression[16] || 0,
        "neutral": faceExpression[17] || 0,
        "relaxed": faceExpression[18] || 0,
        "sad": faceExpression[19] || 0,
        "surprised": faceExpression[20] || 0
    };
    return rawExpressions;
}

function applyThreshold(rawExpressions: FaceBlendshape): FaceBlendshape {
    let max = 0;
    const expressionKeys = ['aa', 'ih', 'ou', 'oh', 'blink_r', 'blink_l', 'angry', 'happy', 'lookDown', 'lookLeft', 'lookRight', 'lookUp', 'neutral', 'relaxed', 'sad', 'surprised'];
    expressionKeys.forEach(key => {
        if (rawExpressions[key]) {
            if (rawExpressions[key] > max) {
                max = rawExpressions[key];
            } else {
                rawExpressions[key] = 0;
            }
        }
    });
    return rawExpressions;
}

function applyExpression(filteredExpressions: any): void {
    const expressionManager = currentVRM.expressionManager;

    if (expressionManager) {
        expressionManager.setValue("blinkRight", filteredExpressions["blink_r"]);
        expressionManager.setValue("blinkLeft", filteredExpressions["blink_l"]);
        expressionManager.setValue("aa", filteredExpressions["aa"]);
        expressionManager.setValue("ih", filteredExpressions["ih"]);
        expressionManager.setValue("ou", filteredExpressions["ou"]);
        expressionManager.setValue("oh", filteredExpressions["oh"]);
        expressionManager.setValue("angry", filteredExpressions["angry"]);
        expressionManager.setValue("happy", filteredExpressions["happy"]);
        expressionManager.setValue("lookDown", filteredExpressions["lookDown"]);
        expressionManager.setValue("lookLeft", filteredExpressions["lookLeft"]);
        expressionManager.setValue("lookRight", filteredExpressions["lookRight"]);
        expressionManager.setValue("lookUp", filteredExpressions["lookUp"]);
        expressionManager.setValue("neutral", filteredExpressions["neutral"]);
        expressionManager.setValue("relaxed", filteredExpressions["relaxed"]);
        expressionManager.setValue("sad", filteredExpressions["sad"]);
        expressionManager.setValue("surprised", filteredExpressions["surprised"]);

        expressionManager.update(); // Ensure this is called to apply changes
    } else {
        console.error("Expression manager is not available");
    }
}

function updateFaceRotation(faceRotation: Array<number>) {
    const headW = 0.8;
    const neckW = 0.2;
    const spineW = 0.1;

    // 頭
    head.rotation.x = faceRotation[0] * headW * -1;
    head.rotation.y = faceRotation[1] * headW;
    head.rotation.z = faceRotation[2] * headW * -1;

    // 首
    neck.rotation.x = faceRotation[0] * neckW * -1;
    neck.rotation.y = faceRotation[1] * neckW;
    neck.rotation.z = faceRotation[2] * neckW * -1;

    // 脊椎
    spine.rotation.x = faceRotation[0] * spineW * -1;
    spine.rotation.y = faceRotation[1] * spineW;
    spine.rotation.z = faceRotation[2] * spineW * -1;
}

export { canvas , update};
