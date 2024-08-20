import * as PIXI from "pixi.js"
import { Spine } from '@esotericsoftware/spine-pixi';

const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  resolution: 1,
  backgroundColor: 0x000,
});
document.body.appendChild(app.view);

console.log(Spine);

PIXI.Assets.add({ alias: "skeleton-data", src: "/spineboy-pro.json" });
PIXI.Assets.add({ alias: "skeleton-atlas", src: "/spineboy-pma.atlas" });

await PIXI.Assets.load(["skeleton-data", "skeleton-atlas"]);

const spineboy = Spine.from("skeleton-data", "skeleton-atlas");

const spineContainer = new PIXI.Container();
spineContainer.scale.set(0.635, 0.635);
spineContainer.addChild(spineboy);

spineContainer.x = window.innerWidth / 2;
spineContainer.y = window.innerHeight / 2;
app.stage.addChild(spineContainer);
