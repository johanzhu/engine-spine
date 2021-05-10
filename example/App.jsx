import React, { useEffect, useRef } from 'react';
import { Stats } from '@oasis-engine/stats'
import "./App.css";
import * as o3 from 'oasis-engine'
import { OrbitControl } from "@oasis-engine/controls";
import { SpineAnimation } from '../src/index';

let engine;
let root;

o3.Engine.registerFeature(Stats);


function App() {

  const oasisRef = useRef(null)

  useEffect(() => {

    init()

    function init() {
      const domCanvas = oasisRef.current
      const canvas = new o3.WebCanvas(domCanvas);
      canvas.width = window.innerWidth * o3.SystemInfo.devicePixelRatio;
      canvas.height = window.innerHeight * o3.SystemInfo.devicePixelRatio;
      engine = new o3.Engine(canvas, new o3.WebGLRenderer());
      const scene = engine.sceneManager.activeScene;
      root = new o3.Entity(engine);
      scene.addRootEntity(root);

      const cameraEntity = root.createChild('camera');
      const camera = cameraEntity.addComponent(o3.Camera);
      camera.farClipPlane = 2000000;
      camera.nearClipPlane = 0.001;
      cameraEntity.transform.position = new o3.Vector3(0, 0, 1200);
      camera.enableFrustumCulling = false;

      cameraEntity.addComponent(OrbitControl)

      loadSpine(root);

      engine.run();
    }

    async function loadSpine(root) {
      const spineEntity = await engine.resourceManager.load(
        {
          urls: [
            // 'https://gw.alipayobjects.com/os/OasisHub/cc4c2531-b501-47bb-a73d-ec9f40a94245/1619588305996.json',
            // 'https://gw.alipayobjects.com/os/OasisHub/4139c037-8f03-45ef-b250-71551396557a/1619588305998.atlas',
            // 'https://gw.alipayobjects.com/zos/OasisHub/7559af07-5e9d-4728-aa67-4743bed3de14/1619588305998.png'
            // 'https://gw.alipayobjects.com/os/OasisHub/db772247-cc85-4adf-ada0-8ac1a9af4d38/1612501401543.json',
            // 'https://gw.alipayobjects.com/os/OasisHub/d1a9487d-c81b-4043-8b71-ba089e9d92a6/1612501401545.atlas',
            // 'https://gw.alipayobjects.com/zos/OasisHub/431a9014-09d7-468c-ab6d-9642057005e7/1612501401545.png'
            // 'https://gw.alipayobjects.com/os/OasisHub/3c38fd35-076c-48f8-b925-3228cf24e21e/1619608313783.json',
            // 'https://gw.alipayobjects.com/os/OasisHub/53b74837-6c83-4cda-b22d-f798b7fe5631/1619608313785.atlas',
            // 'https://gw.alipayobjects.com/zos/OasisHub/d41ab39d-77b8-4eb2-a7d8-ee6984e226d7/1619608313784.png'
            'https://gw.alipayobjects.com/os/OasisHub/724cee18-d336-4c06-8c81-ebd366e8373e/1619609409375.json',
            'https://gw.alipayobjects.com/os/OasisHub/cd307d38-d99f-42ba-9e4d-41d577c61c73/1619609409376.atlas',
            'https://gw.alipayobjects.com/zos/OasisHub/d66a5243-6e36-4449-a4b1-03cc5220b12c/1619609409376.png',
          ],  
          type: 'spine',
        },
        // {
        //   urls: [
        //     'https://gw.alipayobjects.com/os/OasisHub/8081ad50-ee54-4212-b095-3d56caaea321/1612507101048.json',
        //     'https://gw.alipayobjects.com/os/OasisHub/b25bae97-a622-40e4-9965-15fb4f4e5b8a/1612507101049.atlas',
        //     'https://gw.alipayobjects.com/zos/OasisHub/78502992-5fba-4d9c-8a6d-2011f7ead213/1612507101049.png'
        //   ],
        //   type: 'spine',
        // }
      );
      root.addChild(spineEntity);
      spineEntity.transform.setPosition(-300, -700, 0);
      const spineAnimation = spineEntity.getComponent(SpineAnimation);
      spineAnimation.state.setAnimation(0, 'xunhuan', true);
    }

  }, []);

  return <canvas ref={oasisRef} id="canvas"></canvas>;
}

export default App;