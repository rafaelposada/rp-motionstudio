import type { MeshStandardMaterial } from 'three';

// Preserve the original texture's emissive color when image lighting is off.
// Black diffuse alone is insufficient: StandardMaterial still adds specular light.
export function setImageLighting(material: MeshStandardMaterial, enabled: boolean) {
  let uniform = material.userData.motionImageLighting as { value: number } | undefined;
  if (!uniform) {
    uniform = { value: enabled ? 1 : 0 };
    material.userData.motionImageLighting = uniform;
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, renderer) {
      previous.call(this, shader, renderer);
      shader.uniforms.motionImageLighting = uniform!;
      shader.fragmentShader = 'uniform float motionImageLighting;\n' + shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'outgoingLight = mix(totalEmissiveRadiance, outgoingLight, motionImageLighting);\n#include <opaque_fragment>',
      );
    };
    material.customProgramCacheKey = () => 'motion-image-lighting-v1';
    material.needsUpdate = true;
  }
  uniform.value = enabled ? 1 : 0;
}
