import { Stats } from '@oasis-engine/stats';
import { 
  WebGLEngine, 
  Engine, 
  Camera,
  Vector3,
} from "oasis-engine";
import { OrbitControl } from "@oasis-engine/controls";
import { SpineAnimation } from '../src/index';

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

loadSpine(root);

engine.run();

async function loadSpine(root) {
  const spineEntity = await engine.resourceManager.load(
    // {
    //   url: 'https://sbfkcel.github.io/pixi-spine-debug/assets/spine/spineboy-pro.json',
    //   type: 'spine',
    // },
    // {
    //   urls: [
    //     'http://alipay-rmsdeploy-image.cn-hangzhou.alipay.aliyun-inc.com/bakery/huabei-wufu.json',
    //     'http://alipay-rmsdeploy-image.cn-hangzhou.alipay.aliyun-inc.com/bakery/huabei-wufu.atlas'
    //   ],
    //   type: 'spine'
    // }
    {
      urls: [
        'https://gw.alipayobjects.com/os/OasisHub/416cae15-691b-4b19-bb68-fa691c042d30/1626354535504.json',
        'https://gw.alipayobjects.com/os/OasisHub/174a2e33-8946-489f-b93e-7a27a90de4ec/1626354535507.atlas',
        'https://gw.alipayobjects.com/zos/OasisHub/4319fb1d-97dd-4509-9af3-da9c25350452/1626354535507.png'
      ],
      type: 'spine'
    }
  );
  root.addChild(spineEntity);
  const spineAnimation = spineEntity.getComponent(SpineAnimation);
  spineAnimation.state.setAnimation(0, 'animation', true);
  spineAnimation.scale = 0.048;
}


