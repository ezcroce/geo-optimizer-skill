import * as THREE from "three";
import { modelURL } from "./model-assets.js";
import { prepareCharacterMaterials } from "./character-surfaces.js";
import {
  applyCustomerAppearance,
  animateCustomerFace,
} from "./customer-appearance.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

// File GLB originali, locali. Le copie dei personaggi non condividono lo scheletro.
export function createModelLibrary({ onError = () => {} } = {}) {
  const loader = new GLTFLoader();
  const pending = new Map();
  const actors = [];
  const cups = new Set();
  let clock = 0;
  const steamMaterial = new THREE.MeshBasicMaterial({
    color: "#fff4dd",
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const steamGeometry = new THREE.SphereGeometry(0.025, 8, 6);
  function load(name) {
    if (!pending.has(name)) {
      pending.set(
        name,
        loader.loadAsync(modelURL(name, import.meta.env.BASE_URL)),
      );
    }
    return pending.get(name);
  }
  function character(parent, kind, fallback, tint) {
    const actor = {
      parent,
      mixer: null,
      actions: {},
      action: null,
      ready: false,
      kind,
    };
    actors.push(actor);
    load(kind)
      .then((gltf) => {
        const model = clone(gltf.scene);
        model.traverse((node) => {
          if (!node.isMesh) return;
          node.castShadow = true;
          node.receiveShadow = true;
          if (tint) {
            const materials = Array.isArray(node.material)
              ? node.material
              : [node.material];
            const tinted = materials.map((material) => {
              if (material.name !== "Outfit") return material;
              const copy = material.clone();
              copy.color.set(tint);
              if (kind === "barista")
                copy.color.lerp(new THREE.Color("#394541"), 0.35);
              return copy;
            });
            node.material = Array.isArray(node.material) ? tinted : tinted[0];
          }
        });
        prepareCharacterMaterials(model);
        if (kind === "customer") {
          const appearance = parent.userData.customerAppearance ?? {
            kind: 0,
            vip: false,
          };
          applyCustomerAppearance(model, appearance.kind, appearance.vip);
        }
        fallback.forEach((node) => (node.visible = false));
        parent.add(model);
        actor.model = model;
        const head = model.getObjectByName("Head");
        if (head) {
          actor.eye = new THREE.Object3D();
          actor.eye.position.set(0, 0.11, 0);
          head.add(actor.eye);
        }
        actor.mixer = new THREE.AnimationMixer(model);
        for (const clip of gltf.animations)
          actor.actions[clip.name] = actor.mixer.clipAction(clip);
        actor.ready = true;
        setAnimation(actor, "Idle");
      })
      .catch((error) => onError(kind, error));
    return actor;
  }
  function setCupType(parent, type) {
    parent.userData.drinkType = type;
    const model = parent.userData.cupModel;
    if (!model) return;
    const fill = model.getObjectByName("Fill"),
      crema = model.getObjectByName("Crema");
    fill.position.y = type === "espresso" ? 0.245 : 0.287;
    if (crema) crema.position.y = fill.position.y + 0.008;
    for (const [name, visible] of [
      ["Crema", type === "espresso" || type === "doppio"],
      ["LatteArt", type === "latte"],
      ["Foam", type === "cappuccino"],
    ]) {
      const node = model.getObjectByName(name);
      if (node) node.visible = visible;
    }
  }
  function cup(parent) {
    cups.add(parent);
    const fallback = [...parent.children];
    load("cup")
      .then((gltf) => {
        const model = gltf.scene.clone(true);
        const oldFill = parent.userData.fill;
        const fill = model.getObjectByName("Fill");
        fill.visible = oldFill.visible;
        fill.material = oldFill.material;
        fallback.forEach((node) => {
          parent.remove(node);
          node.traverse((part) => part.geometry?.dispose());
        });
        parent.userData.fill = fill;
        parent.add(model);
        parent.userData.cupModel = model;
        setCupType(
          parent,
          parent.userData.drinkType ?? (fill.visible ? "espresso" : "empty"),
        );
        const steam = Array.from({ length: 3 }, () => {
          const puff = new THREE.Mesh(steamGeometry, steamMaterial);
          model.add(puff);
          return puff;
        });
        parent.userData.steam = steam;
        parent.userData.gltf = true;
      })
      .catch((error) => onError("cup", error));
  }
  function setAnimation(actor, name) {
    const next = actor.actions[name];
    if (!next || actor.action === next) return;
    next.reset().play();
    if (actor.action) {
      next.crossFadeFrom(actor.action, 0.25, true);
    }
    actor.action = next;
    actor.animation = name;
  }
  function update(dt, getMode) {
    clock += dt;
    for (const cup of cups) {
      if (!cup.parent) {
        cups.delete(cup);
        continue;
      }
      const hot = cup.userData.drinkType && cup.userData.drinkType !== "empty";
      cup.userData.steam?.forEach((puff, index) => {
        const phase = (clock * 0.5 + index / 3) % 1;
        puff.visible = !!hot;
        puff.position.set(
          Math.sin(phase * 4 + index) * 0.04,
          0.34 + phase * 0.24,
          0,
        );
        puff.scale.setScalar(0.5 + phase);
      });
    }
    for (const actor of actors) {
      if (!actor.ready) continue;
      const mode = getMode(actor);
      if (actor.kind === "customer") {
        const appearance = actor.parent.userData.customerAppearance ?? {
          kind: 0,
          vip: false,
        };
        if (
          actor.model.userData.appearance?.kind !== appearance.kind ||
          actor.model.userData.appearance?.vip !== appearance.vip
        )
          applyCustomerAppearance(actor.model, appearance.kind, appearance.vip);
      }
      animateCustomerFace(actor.model, mode, clock);
      setAnimation(actor, mode);
      actor.mixer.update(dt);
    }
  }
  return { character, cup, setCupType, update, actors, load };
}
