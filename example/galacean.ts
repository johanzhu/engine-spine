import {
  WebGLEngine,
  Camera,
  Entity,
  Vector3,
  Logger,
  KTX2TargetFormat,
  Engine,
} from "@galacean/engine";
import { SpineAnimationRenderer } from "../src/index";
import { SkeletonDataResource } from "../src/loader/SkeletonDataResource";

WebGLEngine.create({
  canvas: "canvas",
  ktx2Loader: {
    workerCount: 4,
    priorityFormats: [
      KTX2TargetFormat.ASTC,
      KTX2TargetFormat.ETC,
      KTX2TargetFormat.PVRTC,
    ],
  },
}).then((engine) => {
  engine.canvas.resizeByClientSize(1);
  engine.run();

  const scene = engine.sceneManager.activeScene;
  scene.background.solidColor.set(0, 0, 0, 1);
  const root = scene.createRootEntity();
  scene.addRootEntity(root);

  const cameraEntity = root.createChild("camera_node");
  const camera = cameraEntity.addComponent(Camera);
  cameraEntity.transform.position = new Vector3(0, 0, 2000);
  camera.fieldOfView = 45;
  camera.aspectRatio = window.innerWidth / window.innerHeight;
  camera.nearClipPlane = 1;
  camera.farClipPlane = 3000;

  loadSpine(root, engine);
});

async function loadSpine(root: Entity, engine: Engine) {
  const skeletonDataResource = (await engine.resourceManager.load({
      urls: ["/spineboy-pro.json", "/spineboy-pma.atlas"],
      type: 'spine'
    })) as SkeletonDataResource;
  if (!skeletonDataResource) return;
  const spineEntity = new Entity(engine, 'spine-entity');
  spineEntity.transform.setPosition(0, 0, 0);
  const spineAnimation = spineEntity.addComponent(SpineAnimationRenderer);
  spineAnimation.defaultState.scale = 1;
  spineAnimation.resource = skeletonDataResource;
  spineAnimation.setting.premultipliedAlpha = true;
  root.addChild(spineEntity);
}
