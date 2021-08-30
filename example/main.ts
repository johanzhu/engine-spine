import { Stats } from '@oasis-engine/stats';
import { 
  WebGLEngine, 
  Engine, 
  Camera,
  Entity,
  Vector3,
  AssetType,
  Texture2D
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
  const [spineEntity, hackTexture] = await engine.resourceManager.load([
    {
      url: 'https://sbfkcel.github.io/pixi-spine-debug/assets/spine/spineboy-pro.json',
      type: 'spine',
    },
    {
      type: AssetType.Texture2D,
      url: 'https://gw.alicdn.com/imgextra/i2/O1CN01ZrLkcl1njIXAnhTbK_!!6000000005125-2-tps-1534-533.png'
    },
    // {
    //   url: 'http://alipay-rmsdeploy-image.cn-hangzhou.alipay.aliyun-inc.com/bakery/Fish.json',
    //   type: 'spine',
    // },
    // {
    //   urls: [
    //     'https://gw.alipayobjects.com/os/OasisHub/416cae15-691b-4b19-bb68-fa691c042d30/1626354535504.json',
    //     'https://gw.alipayobjects.com/os/OasisHub/174a2e33-8946-489f-b93e-7a27a90de4ec/1626354535507.atlas',
    //     'https://gw.alipayobjects.com/zos/OasisHub/4319fb1d-97dd-4509-9af3-da9c25350452/1626354535507.png'
    //   ],
    //   type: 'spine'
    // }
  ]) as [Entity, Texture2D];
  root.addChild(spineEntity);
  const spineAnimation = spineEntity.getComponent(SpineAnimation);
  spineAnimation.state.setAnimation(0, 'hoverboard', true);
  spineAnimation.scale = 0.05;
  spineAnimation.addSeparateSlot('gun');
  // spineAnimation.hackSeparateSlotTexture('gun', hackTexture);
}
