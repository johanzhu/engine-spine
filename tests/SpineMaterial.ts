import { describe, beforeEach, expect, it } from "vitest";
import { WebGLEngine, CullMode, RenderQueueType } from "@galacean/engine";
import { SpineMaterial } from "../src/SpineMaterial";
import { getBlendMode } from "../src/util/BlendMode";
import { BlendMode } from "@esotericsoftware/spine-core";
import { createEngine } from "./testUtils";

describe.only("SpineMaterial", function () {
  let engine: WebGLEngine;
  beforeAll(async function () {
    engine = await createEngine();
  });

  it("Should create a SpineMaterial with the correct default properties", function () {
    const material = new SpineMaterial(engine);

    // 验证着色器是否已正确创建并赋值
    expect(material.shader).to.not.be.undefined;
    expect(material.shader.name).to.equal("galacean-spine-shader");

    // 验证混合状态是否启用
    const target = material.renderState.blendState.targetBlendState;
    expect(target.enabled).to.be.true;

    // 检查默认混合模式是否为 Normal
    const blenMode = getBlendMode(material);
    expect(blenMode).to.equal(BlendMode.Normal);

    // 验证深度状态和剔除模式
    expect(material.renderState.depthState.writeEnabled).to.be.false;
    expect(material.renderState.rasterState.cullMode).to.equal(CullMode.Off);

    // 验证渲染队列类型
    expect(material.renderState.renderQueueType).to.equal(RenderQueueType.Transparent);
  });
});
