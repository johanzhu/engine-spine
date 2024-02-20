import { Material } from '@galacean/engine';

export class MaterialManager {
  sharedMaterials: Material[] = [];
  submeshMaterials: Material[] = [];

  getUpdatedSharedMaterialsArray(): Material[] {
    if (this.submeshMaterials.length === this.sharedMaterials.length) {
      for (let i = 0; i < this.submeshMaterials.length; i++) {
        this.sharedMaterials[i] = this.submeshMaterials[i];
      }
    } else {
    this.sharedMaterials = this.submeshMaterials.slice();
    }
    return this.sharedMaterials;
  }

  materialsChangedInLastUpdate(): boolean {
    const newSubmeshMaterials = this.submeshMaterials;
    const sharedMaterials = this.sharedMaterials;

    if (newSubmeshMaterials.length !== sharedMaterials.length) return true;

    for (let i = 0; i < newSubmeshMaterials.length; i++) {
      if (this.submeshMaterials[i].instanceId !== sharedMaterials[i].instanceId) return true;
    }

    return false;
  }

  

}