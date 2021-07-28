import { Layer, Oasis } from "oasis-engine";
import { OutlineAbility } from "./OutlineAbility";

export const outline = (oasis: Oasis) => {
  const root = oasis.engine.sceneManager.activeScene.getRootEntity();
  const entity = root.createChild("outline");
  const outlineAbility = entity.addComponent(OutlineAbility);

  entity.layer = Layer.Layer1;
  return {
    abilityAdded: () => {
      outlineAbility.updateBoundingBox();
    },
    abilityDeleted: () => {
      outlineAbility.updateBoundingBox();
    },
    schemaParsed: () => {
      oasis.on("selected", (data) => {
        const { currSelectedId } = data;
        if (!currSelectedId) {
          entity.isActive = false;
        } else {
          entity.isActive = true;
          const selectedNode = oasis.nodeManager.get(currSelectedId);
          outlineAbility.updateSelectedNode(selectedNode);
          // oasis.abilityManager.
        }
      });
    }
  };
};
