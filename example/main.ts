import { Stats } from '@oasis-engine/stats';
import { 
  WebGLEngine, 
  Engine, 
  Camera,
  Vector3,
  Entity,
  Texture2D,
} from "oasis-engine";
import { OrbitControl } from "@oasis-engine/controls";
import { SpineAnimation } from '../src/index';
import { OutlineAbility } from './outline/OutlineAbility';

Engine.registerFeature(Stats);

const engine = new WebGLEngine('canvas');
engine.canvas.resizeByClientSize();
const scene = engine.sceneManager.activeScene;
const root = scene.createRootEntity();
scene.addRootEntity(root);

const cameraEntity = root.createChild('camera');
const camera = cameraEntity.addComponent(Camera);
camera.farClipPlane = 2000000;
camera.nearClipPlane = 0.001;
cameraEntity.transform.position = new Vector3(0, 0, 120);

cameraEntity.addComponent(OrbitControl);

const outlineEntity = root.createChild('outline');
const outline = outlineEntity.addComponent(OutlineAbility);


loadSpine(root);

engine.run();

async function loadSpine(root) {
  const spineEntity = await engine.resourceManager.load(
    // {
    //   url: 'https://sbfkcel.github.io/pixi-spine-debug/assets/spine/spineboy-pro.json',
    //   type: 'spine',
    // },
    {
      urls: [
        'https://gw.alipayobjects.com/os/OasisHub/e675c9e1-2b19-4940-b8ed-474792e613d7/1629603245094.json',
        'https://gw.alipayobjects.com/os/OasisHub/994dfadc-c498-4210-b9ba-0c3deed61fc5/1629603245095.atlas',
        'https://gw.alicdn.com/imgextra/i1/O1CN0194w88U1hpoTfeSuBu_!!6000000004327-2-tps-802-256.png'
      ],
      type: 'spine'
    },
  ) as Entity;
  root.addChild(spineEntity);
  const spineAnimation = spineEntity.getComponent(SpineAnimation);
  spineAnimation.state.setAnimation(0, '03_run', true);
  spineAnimation.scale = 0.1;
  spineAnimation.skeleton.setSkinByName('skin1');
}



