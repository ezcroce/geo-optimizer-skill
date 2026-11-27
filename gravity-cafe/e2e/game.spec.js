import { test, expect } from "@playwright/test";

// La simulazione, le collisioni e gli input sono quelli veri. Si disabilita
// soltanto il draw GPU per avanzare il clock deterministicamente in CI.
// Nessun hook di test viene incluso nel bundle di produzione.
const runtimeErrors = new WeakMap();
test.afterEach(async ({ page }) =>
  expect(runtimeErrors.get(page) ?? []).toEqual([]),
);
test.beforeEach(async ({ page }) => {
  const errors = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/src/main.js*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        "\nwindow.__game={world,state:()=>state,jobs:()=>jobs,orders:()=>orders,makeOrder,renderOrders};",
    });
  });
  await page.route("**/src/world.js*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text())
        .replace(
          /renderer\.render\(scene,\s*(?:camera|menuCamera|cameras\[i\])\)/g,
          "(()=>{})()",
        )
        .replace(
          "  return {\n    update,",
          "  window.__worldTest={floats,models,players,handCups,renderer};\n  return {\n    update,",
        ),
    });
  });
  const startTime = new Date("2026-11-27T12:00:00Z");
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);
  await page.goto("/");
});

async function start(page) {
  await page.locator("#start").click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-screen",
    "countdown",
  );
  await page.clock.runFor(3200);
  await expect(page.locator("body")).toHaveAttribute("data-screen", "playing");
}
async function aim(page, index, x, y, z) {
  await page.evaluate(
    ({ index, x, y, z }) => {
      const camera = window.__game.world.getCamera(index).clone();
      camera.lookAt(x, y, z);
      window.__game.world.getView(index).copy(camera.quaternion);
    },
    { index, x, y, z },
  );
}
const held = (page) => page.evaluate(() => window.__game.world.getDrink(0));

test("complete gameplay: physical cup, brewing, pause, spill, recovery, serving and stars", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.locator(".rail, .workspace, footer")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > innerHeight,
    ),
  ).toBe(false);
  await start(page);
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe("empty");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(400);
  const job = await page.evaluate(() => window.__game.jobs()[0].elapsed);
  expect(job).toBeGreaterThan(0);
  await page.locator("#pause").click();
  const snapshot = () =>
    page.evaluate(() => ({
      job: window.__game.jobs()[0].elapsed,
      time: window.__game.state().remaining,
      orders: window.__game.orders().map((o) => o.time),
    }));
  const frozen = await snapshot();
  await page.clock.fastForward(60000);
  expect(await snapshot()).toEqual(frozen);
  await page.locator("#resume").click();
  await page.clock.runFor(1100);
  expect(await held(page)).toBe("espresso");
  await page.keyboard.press("KeyQ");
  expect(await held(page)).toBe(null);
  await page.clock.runFor(700);
  expect(
    await page.evaluate(() => window.__game.state().spills),
  ).toBeGreaterThan(0);
  const item = await page.evaluate(() => {
    const cup = window.__worldTest.floats.find(
      (item) => item.userData.pickupType,
    );
    return { x: cup.position.x, y: cup.position.y + 0.15, z: cup.position.z };
  });
  await aim(page, 0, item.x, item.y, item.z);
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe("empty");
  await aim(page, 0, -6.05, 2.05, -5.1);
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1400);
  expect(await held(page)).toBe("espresso");
  await page.evaluate(() =>
    window.__game.world.getPosition(0).set(-1.8, 0.13, -0.25),
  );
  await aim(page, 0, -1.8, 1.2, 1.97);
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe(null);
  expect(await page.evaluate(() => window.__game.state().served)).toBe(1);
  await aim(page, 0, 0, 1.73, -4);
  const x = await page.evaluate(() => window.__game.world.getPosition(0).x);
  await page.keyboard.down("KeyD");
  await page.clock.runFor(300);
  await page.keyboard.up("KeyD");
  expect(
    await page.evaluate(() => window.__game.world.getPosition(0).x),
  ).toBeGreaterThan(x);
  await page.evaluate(() => {
    window.__game.state().score = 450;
    window.__game.state().remaining = 0.01;
  });
  await page.clock.runFor(100);
  await expect(page.locator("body")).toHaveAttribute("data-screen", "results");
  await expect(page.locator(".result-stars .earned")).toHaveCount(1);
  expect(
    await page.evaluate(() => localStorage.getItem("gravity-best:CLASSICO")),
  ).toBe("450");
  expect(errors).toEqual([]);
});

test("two local players have separate cups and can both prepare orders", async ({
  page,
}) => {
  await page.locator("#coop").click();
  await start(page);
  await page.keyboard.press("KeyE");
  await page.evaluate(() =>
    window.__game.world.getPosition(1).set(-5.8, 0.13, -3.1),
  );
  await aim(page, 1, -6.05, 2.05, -5.1);
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate(() =>
      [0, 1].map((i) => window.__game.world.getDrink(i)),
    ),
  ).toEqual(["empty", "empty"]);
  await page.keyboard.press("KeyE");
  await page.keyboard.press("Enter");
  await page.clock.runFor(1400);
  expect(
    await page.evaluate(() =>
      [0, 1].map((i) => window.__game.world.getDrink(i)),
    ),
  ).toEqual(["espresso", "espresso"]);
});

test("gamepad actions are edge-triggered instead of auto-brewing while held", async ({
  page,
}) => {
  await page.evaluate(() =>
    Object.defineProperty(navigator, "getGamepads", {
      value: () => (window.__pad ? [window.__pad] : []),
    }),
  );
  await start(page);
  await page.evaluate(() => {
    window.__pad = {
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    };
    window.__pad.buttons[0].pressed = true;
  });
  await page.clock.runFor(200);
  expect(await held(page)).toBe("empty");
  await page.clock.runFor(1500);
  expect(await held(page)).toBe("empty");
  await page.evaluate(() => (window.__pad.buttons[0].pressed = false));
  await page.clock.runFor(50);
  await page.evaluate(() => (window.__pad.buttons[0].pressed = true));
  await page.clock.runFor(1500);
  expect(await held(page)).toBe("espresso");
});

test("Melt-Core is playable across decks, and overheating evacuates the ground floor", async ({
  page,
}) => {
  await page.locator('[data-level="3"]').click();
  await start(page);
  await aim(page, 0, -7.1578947368, 0.9, 0.8947368421);
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1200);
  expect(await page.evaluate(() => window.__game.world.getDeck(0))).toBe(1);
  await page.evaluate(() =>
    window.__game.world.getPosition(0).set(-4.8571428571, 3.33, -1.2),
  );
  await aim(page, 0, -4.8571428571, 4.95, -2.3063909774);
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1400);
  expect(await held(page)).toBe("espresso");
  await page.evaluate(() =>
    window.__game.world.getPosition(0).set(-7.1578947368, 3.33, 0.8947368421),
  );
  await aim(page, 0, -7.1578947368, 4.1, 0.8947368421);
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1200);
  expect(await page.evaluate(() => window.__game.world.getDeck(0))).toBe(2);
  await page.evaluate(() =>
    window.__game.world.getPosition(0).set(4.8571428571, 6.53, -1.2),
  );
  await aim(page, 0, 4.8571428571, 8.15, -2.3063909774);
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1100);
  expect(await held(page)).toBe("latte");
  await page.evaluate(() =>
    window.__game.world.getPosition(0).set(-7.1578947368, 6.53, 0.8947368421),
  );
  await aim(page, 0, -7.1578947368, 7.3, 0.8947368421);
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1200);
  expect(await page.evaluate(() => window.__game.world.getDeck(0))).toBe(0);
  await page.evaluate(() => (window.__game.state().elapsed = 44.9));
  await page.clock.runFor(200);
  expect(await page.evaluate(() => window.__game.state().gravity)).toBe(0);
  expect(await page.evaluate(() => window.__game.world.getDeck(0))).toBe(1);
  expect(
    await page.evaluate(() => window.__game.world.getPosition(0).y),
  ).toBeGreaterThanOrEqual(3.33);
});

test("missed orders can end a shift in failure, not only a score screen", async ({
  page,
}) => {
  await start(page);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() =>
      window.__game.orders().forEach((order) => (order.time = 0.01)),
    );
    await page.clock.runFor(100);
  }
  await expect(page.locator("body")).toHaveAttribute("data-screen", "results");
  await expect(page.locator(".result-stars .earned")).toHaveCount(0);
  await expect(page.locator("#result-eyebrow")).toHaveText(
    "TROPPI CLIENTI PERSI",
  );
});

test.describe("mobile controls", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("portrait touch controls activate immediately and clear safely on pause", async ({
    page,
  }) => {
    const startBox = await page.locator("#start").boundingBox();
    expect(startBox.y + startBox.height).toBeLessThanOrEqual(844);
    await start(page);
    const button = page.locator('[data-key="KeyD"]');
    const bounds = await button.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await button.dispatchEvent("pointerdown", {
      pointerId: 9,
      pointerType: "touch",
      bubbles: true,
    });
    await expect(button).toHaveClass(/active/);
    await button.dispatchEvent("pointercancel", {
      pointerId: 9,
      pointerType: "touch",
      bubbles: true,
    });
    await expect(button).not.toHaveClass(/active/);
    await button.dispatchEvent("pointerdown", {
      pointerId: 10,
      pointerType: "touch",
      bubbles: true,
    });
    await page.locator("#pause").click();
    await expect(button).not.toHaveClass(/active/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
});

test.describe("landscape phone", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  test("the menu and play controls fit a landscape screen without scrolling", async ({
    page,
  }) => {
    const bounds = await page.locator("#start").boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(390);
    await start(page);
    await expect(page.locator(".touch-interact")).toBeVisible();
    const canvas = await page.locator("#scene").boundingBox();
    expect(canvas.width).toBe(844);
    expect(canvas.height).toBe(390);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight > innerHeight,
      ),
    ).toBe(false);
  });
});

test("first-person interaction is a centre ray, not a proximity hotkey", async ({
  page,
}) => {
  await start(page);
  expect(
    await page.evaluate(
      () => window.__game.world.getCamera(0).isPerspectiveCamera,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.__game.world.getTarget(0)?.station),
  ).toBe("coffee");
  await aim(page, 0, -5.9, 1.73, 3);
  expect(await page.evaluate(() => window.__game.world.getStation(0))).toBe(
    null,
  );
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe(null);
  await aim(page, 0, -6.05, 2.05, -5.1);
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe("empty");
  // Una macchina vicina in pianta ma lontana in quota non è interagibile.
  await page.evaluate(() => (window.__game.world.getPosition(0).y = 8));
  await aim(page, 0, -6.05, 2.05, -5.1);
  expect(await page.evaluate(() => window.__game.world.getStation(0))).toBe(
    null,
  );
});

test("zero-G supports altitude, roll, three-axis inertia and braking; pause freezes the body", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const w = window.__game.world;
    w.getPosition(0).set(-1, 0.2, 0);
    w.getView(0).identity();
    window.__game.state().gravity = 0;
    window.__game.state().gravityClock = 20;
  });
  await page.keyboard.down("KeyR");
  await page.clock.runFor(650);
  await page.keyboard.up("KeyR");
  const first = await page.evaluate(() => window.__game.world.getPosition(0).y);
  expect(first).toBeGreaterThan(0.7);
  await page.clock.runFor(200);
  expect(
    await page.evaluate(() => window.__game.world.getPosition(0).y),
  ).toBeGreaterThan(first);
  await page.keyboard.down("ShiftLeft");
  await page.clock.runFor(1000);
  await page.keyboard.up("ShiftLeft");
  const speed = await page.evaluate(() =>
    window.__game.world.getVelocity(0).length(),
  );
  expect(speed).toBeLessThan(0.01);
  const before = await page.evaluate(() =>
    window.__game.world.getView(0).toArray(),
  );
  await page.keyboard.down("KeyZ");
  await page.clock.runFor(600);
  await page.keyboard.up("KeyZ");
  expect(
    await page.evaluate(() => window.__game.world.getView(0).toArray()),
  ).not.toEqual(before);
  await page.keyboard.down("KeyW");
  await page.clock.runFor(400);
  await page.keyboard.up("KeyW");
  await page.locator("#pause").click();
  const frozen = await page.evaluate(() => ({
    p: window.__game.world.getPosition(0).toArray(),
    q: window.__game.world.getView(0).toArray(),
  }));
  await page.clock.fastForward(60000);
  expect(
    await page.evaluate(() => ({
      p: window.__game.world.getPosition(0).toArray(),
      q: window.__game.world.getView(0).toArray(),
    })),
  ).toEqual(frozen);
});

test("local GLB skeletons play and cross-fade walk/float clips, while pause freezes their mixers", async ({
  page,
}) => {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__game.world.getActors().filter((actor) => actor.ready).length,
      ),
    )
    .toBeGreaterThanOrEqual(5);
  expect(
    await page.evaluate(() =>
      window.__game.world
        .getActors()
        .slice(0, 2)
        .every(
          (actor) =>
            actor.model.getObjectByProperty("isSkinnedMesh", true) &&
            ["Idle", "Walk", "Float"].every((name) => actor.actions[name]),
        ),
    ),
  ).toBe(true);
  await start(page);
  await page.keyboard.press("KeyE");
  await expect
    .poll(() =>
      page.evaluate(() => !!window.__worldTest.handCups[0]?.userData.gltf),
    )
    .toBe(true);
  await page.keyboard.down("KeyD");
  await page.clock.runFor(300);
  await page.keyboard.up("KeyD");
  expect(
    await page.evaluate(() => window.__game.world.getActors()[0].animation),
  ).toBe("Walk");
  const bones = await page.evaluate(() => {
    const actor = window.__game.world.getActors()[0];
    return actor.model.getObjectByName("LegL").quaternion.toArray();
  });
  await page.clock.runFor(100);
  expect(
    await page.evaluate(() =>
      window.__game.world
        .getActors()[0]
        .model.getObjectByName("LegL")
        .quaternion.toArray(),
    ),
  ).not.toEqual(bones);
  await page.evaluate(() => {
    window.__game.state().gravity = 0;
    window.__game.state().gravityClock = 10;
  });
  await page.clock.runFor(100);
  expect(
    await page.evaluate(() => window.__game.world.getActors()[0].animation),
  ).toBe("Float");
  await page.locator("#pause").click();
  const time = await page.evaluate(
    () => window.__game.world.getActors()[0].mixer.time,
  );
  await page.clock.runFor(500);
  expect(
    await page.evaluate(() => window.__game.world.getActors()[0].mixer.time),
  ).toBe(time);
});

test("split-screen has two head cameras, independent look and separate reticles", async ({
  page,
}) => {
  await page.locator("#coop").click();
  await start(page);
  await expect(page.locator(".fps-view-0")).toBeVisible();
  await expect(page.locator(".fps-view-1")).toBeVisible();
  const boxes = await Promise.all(
    [0, 1].map((i) => page.locator(`.fps-view-${i}`).boundingBox()),
  );
  expect(boxes[0].width).toBe(720);
  expect(boxes[1].x).toBe(720);
  expect(
    await page.evaluate(
      () =>
        window.__game.world.getCamera(0) === window.__game.world.getCamera(1),
    ),
  ).toBe(false);
  const p1 = await page.evaluate(() =>
    window.__game.world.getView(0).toArray(),
  );
  const p2 = await page.evaluate(() =>
    window.__game.world.getView(1).toArray(),
  );
  await page.keyboard.down("KeyL");
  await page.clock.runFor(300);
  await page.keyboard.up("KeyL");
  const stable = await page.evaluate(() =>
    window.__game.world.getView(0).toArray(),
  );
  stable.forEach((value, index) => expect(value).toBeCloseTo(p1[index], 10));
  expect(
    await page.evaluate(() => window.__game.world.getView(1).toArray()),
  ).not.toEqual(p2);
  // Il torso ora respira: l'ancoraggio dell'osso può oscillare di pochi millimetri.
  const eyeHeight = await page.evaluate(
    () =>
      window.__game.world.getCamera(0).position.y -
      window.__game.world.getPosition(0).y,
  );
  expect(eyeHeight).toBeGreaterThan(1.57);
  expect(eyeHeight).toBeLessThan(1.63);
});

test("model-loading failures retain playable fallbacks instead of breaking the shift", async ({
  page,
}) => {
  await page.route("**/models/*.glb", (route) => route.abort());
  await page.reload();
  await start(page);
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe("empty");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1400);
  expect(await held(page)).toBe("espresso");
  await expect(page.locator("#fatal")).toBeHidden();
});

test.describe("touch look", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  test("dragging the scene turns the camera, cancellation stops look, and touch thrust changes altitude", async ({
    page,
  }) => {
    await start(page);
    const before = await page.evaluate(() =>
      window.__game.world.getView(0).toArray(),
    );
    const canvas = page.locator("#scene");
    await canvas.dispatchEvent("pointerdown", {
      pointerId: 7,
      pointerType: "touch",
      clientX: 500,
      clientY: 180,
    });
    await canvas.dispatchEvent("pointermove", {
      pointerId: 7,
      pointerType: "touch",
      clientX: 560,
      clientY: 200,
    });
    const after = await page.evaluate(() =>
      window.__game.world.getView(0).toArray(),
    );
    expect(after).not.toEqual(before);
    await canvas.dispatchEvent("pointercancel", {
      pointerId: 7,
      pointerType: "touch",
    });
    await canvas.dispatchEvent("pointermove", {
      pointerId: 7,
      pointerType: "touch",
      clientX: 620,
      clientY: 250,
    });
    expect(
      await page.evaluate(() => window.__game.world.getView(0).toArray()),
    ).toEqual(after);
    await page.evaluate(() => {
      window.__game.world.getPosition(0).set(-1, 0.2, 0);
      window.__game.world.getView(0).identity();
      window.__game.state().gravity = 0;
      window.__game.state().gravityClock = 10;
    });
    await page
      .locator('[data-deck="1"]')
      .dispatchEvent("pointerdown", { pointerId: 8, pointerType: "touch" });
    await page.clock.runFor(600);
    await page
      .locator('[data-deck="1"]')
      .dispatchEvent("pointerup", { pointerId: 8, pointerType: "touch" });
    expect(
      await page.evaluate(() => window.__game.world.getPosition(0).y),
    ).toBeGreaterThan(0.5);
  });
});

async function faceCustomer(page, id) {
  await page.evaluate((id) => {
    const w = window.__game.world,
      c = w
        .getCustomers()
        .find((c) => c.order?.id === id && c.phase !== "leaving");
    const position = c.group.position;
    w.getPosition(0).set(position.x, position.y, position.z - 2.05);
    const camera = w.getCamera(0).clone();
    camera.lookAt(position.x, position.y + 1.1, position.z);
    w.getView(0).copy(camera.quaternion);
  }, id);
}

test("VIPs match their visible customer and pay double; expiry removes fifty points", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1400);
  await page.evaluate(() => {
    const g = window.__game;
    g.orders().splice(
      0,
      1,
      g.makeOrder(6, () => 0.5, { elapsed: 50 }),
    );
    g.renderOrders();
  });
  await page.clock.runFor(1300);
  await expect(page.locator('[data-ticket="7"]')).toHaveClass(/vip/);
  expect(
    await page.evaluate(
      () =>
        window.__game.world
          .getCustomers()
          .filter((c) => c.order && c.phase !== "leaving").length,
    ),
  ).toBe(3);
  // Espresso richiesto dal VIP #7, non dal vicino #2 che aspetta latte.
  await faceCustomer(page, 2);
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe("espresso");
  expect(await page.evaluate(() => window.__game.state().score)).toBe(0);
  await faceCustomer(page, 7);
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe(null);
  expect(await page.evaluate(() => window.__game.state().score)).toBe(200);
  await page.clock.runFor(100);
  expect(
    await page.evaluate(
      () =>
        window.__game.world.getCustomers().find((c) => c.order?.id === 7)?.body
          .userData.customerAnimation,
    ),
  ).toBe("Cheer");
  await page.evaluate(() => {
    const g = window.__game;
    const vip = g.makeOrder(9, () => 0.5, { elapsed: 50 });
    vip.time = 0.01;
    g.orders().splice(0, 1, vip);
    g.renderOrders();
  });
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.__game.state().score)).toBe(150);
  expect(await page.evaluate(() => window.__game.state().missed)).toBe(1);
});

test("demanding tickets retain a partial delivery, complete with the second recipe and replace only that customer", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const g = window.__game;
    g.orders().splice(
      0,
      1,
      g.makeOrder(8, () => 0.5, { elapsed: 90 }),
    );
    g.renderOrders();
  });
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1400);
  await faceCustomer(page, 9);
  await page.keyboard.press("KeyE");
  expect(await held(page)).toBe(null);
  expect(
    await page.evaluate(() => ({
      count: window.__game.orders().length,
      served: window.__game.state().served,
      score: window.__game.state().score,
    })),
  ).toEqual({ count: 3, served: 0, score: 0 });
  await expect(page.locator('[data-ticket="9"] .delivered')).toHaveCount(1);
  await page.evaluate(() =>
    window.__game.world.getPosition(0).set(-5.9, 0.13, -3.1),
  );
  await aim(page, 0, -6.05, 2.05, -5.1);
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1400);
  await page.evaluate(() =>
    window.__game.world.getPosition(0).set(6.4, 0.13, -3.1),
  );
  await aim(page, 0, 6.4, 1.85, -5.1);
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1100);
  expect(await held(page)).toBe("latte");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(900);
  expect(await held(page)).toBe("cappuccino");
  await faceCustomer(page, 9);
  await page.keyboard.press("KeyE");
  expect(
    await page.evaluate(() => ({
      count: window.__game.orders().length,
      served: window.__game.state().served,
      score: window.__game.state().score,
    })),
  ).toEqual({ count: 3, served: 1, score: 200 });
  await expect(page.locator('[data-ticket="9"]')).toHaveCount(0);
  await page.clock.runFor(3500);
  expect(
    await page.evaluate(() =>
      window.__game.world.getCustomers().some((c) => c.order?.id === 9),
    ),
  ).toBe(false);
  expect(
    await page.evaluate(
      () =>
        window.__game.world
          .getCustomers()
          .filter((c) => c.order && c.phase === "waiting").length,
    ),
  ).toBe(3);
});

test("second extraction makes a visibly distinct Doppio and urgency agitates customers without bypassing pause", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.press("KeyE");
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1400);
  await page.keyboard.press("KeyE");
  await page.clock.runFor(1200);
  expect(await held(page)).toBe("doppio");
  await expect(page.locator("#inventory-name")).toHaveText("Doppio espresso");
  await page.evaluate(() => {
    const g = window.__game;
    g.state().gravity = 0;
    g.state().gravityClock = 20;
    g.orders()[0].time = g.orders()[0].total * 0.2;
    const c = g.world.getCustomers().find((c) => c.order?.id === 1);
    const object = window.__worldTest.floats[0];
    object.position.copy(c.group.position);
    object.position.y += 1;
    object.userData.base.copy(object.position);
    object.userData.velocity.set(0, 0, 0);
  });
  await page.clock.runFor(3300);
  expect(
    await page.evaluate(() => {
      const c = window.__game.world
        .getCustomers()
        .find((c) => c.order?.id === 1);
      return (
        c.urgent &&
        c.redLight.intensity > 0 &&
        c.body.userData.customerAnimation === "Hurry"
      );
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => window.__worldTest.floats[0].userData.jostleUntil,
    ),
  ).toBeGreaterThan(0);
  await expect(page.locator('[data-ticket="1"]')).toHaveClass(/urgent/);
  await page.locator("#pause").click();
  const snapshot = () =>
    page.evaluate(() =>
      window.__game.world
        .getCustomers()
        .filter((c) => c.order)
        .map((c) => ({
          id: c.order.id,
          age: c.age,
          position: c.group.position.toArray(),
          bump: c.lastBump,
          time: c.order.time,
        })),
    );
  const frozen = await snapshot();
  await page.clock.fastForward(60000);
  expect(await snapshot()).toEqual(frozen);
});

for (const [level, name] of [
  [5, "Magnetic"],
  [6, "Cryo"],
  [7, "Reactor"],
]) {
  test(`${name}: eighth-station menu, real brewing and service remain playable`, async ({
    page,
  }) => {
    await page.locator(`[data-level="${level}"]`).click();
    await expect(page.locator("#station-number")).toHaveText(
      `0${level + 1} / 08`,
    );
    await start(page);
    await page.keyboard.press("KeyE");
    expect(await held(page)).toBe("empty");
    await page.keyboard.press("KeyE");
    await page.clock.runFor(1400);
    expect(await held(page)).toBe("espresso");
    const service = await page.evaluate(
      async (level) =>
        (await import("/src/map-mechanics.js")).getMapStations(level, 0)
          .service,
      level,
    );
    await page.evaluate(
      (s) =>
        window.__game.world
          .getPosition(0)
          .set(s.x, (s.elevation ?? 0) + 0.13, s.z - 2),
      service,
    );
    await aim(page, 0, service.x, (service.elevation ?? 0) + 1.35, service.z);
    await faceCustomer(page, 1);
    await page.keyboard.press("KeyE");
    expect(await held(page)).toBe(null);
    expect(await page.evaluate(() => window.__game.state().served)).toBe(1);
    await page.locator("#pause").click();
    const time = await page.evaluate(() => window.__game.state().elapsed);
    await page.clock.fastForward(10000);
    expect(await page.evaluate(() => window.__game.state().elapsed)).toBe(time);
  });
}

test("Magnetic field moves a body and a thrown cup while a floor plate anchors the body", async ({
  page,
}) => {
  await page.locator('[data-level="5"]').click();
  await start(page);
  await page.evaluate(() => {
    const g = window.__game;
    Object.assign(g.state(), { elapsed: 20, gravity: 0 });
    g.world.getPosition(0).set(1, 0.13, 1);
    g.world.holdDrink(0, "espresso");
  });
  await page.keyboard.press("Space");
  await page.clock.runFor(600);
  expect(
    await page.evaluate(() => window.__game.world.getVelocity(0).z),
  ).toBeGreaterThan(0.8);
  expect(
    await page.evaluate(() =>
      window.__worldTest.floats.some((c) => c.userData.thrown),
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    const { MAGNET_PLATES } = await import("/src/map-mechanics.js");
    const p = MAGNET_PLATES[0];
    window.__game.world.getPosition(0).set(p.x, 0.13, p.z);
  });
  await page.clock.runFor(600);
  expect(
    await page.evaluate(() => window.__game.world.getVelocity(0).length()),
  ).toBeLessThan(0.03);
});

test("Cryo vents actually lift grounded bodies and zero-G crystals deflect physical cups", async ({
  page,
}) => {
  await page.locator('[data-level="6"]').click();
  await start(page);
  await page.evaluate(async () => {
    const p = (await import("/src/map-mechanics.js")).CRYO_VENTS[0];
    window.__game.state().elapsed = 0.1;
    window.__game.world.getPosition(0).set(p.x, 0.13, p.z);
  });
  await page.clock.runFor(650);
  expect(
    await page.evaluate(() => window.__game.world.getPosition(0).y),
  ).toBeGreaterThan(0.7);
  await page.evaluate(() => {
    const g = window.__game;
    Object.assign(g.state(), { elapsed: 24, gravity: 0 });
    g.world.holdDrink(0, "espresso");
  });
  await page.keyboard.press("Space");
  await page.evaluate(async () => {
    const c = (await import("/src/map-mechanics.js")).iceCrystals(
      window.__game.state().elapsed,
    )[0];
    const cup = window.__worldTest.floats.find((c) => c.userData.thrown);
    cup.position.set(c.x + 0.22, c.y, c.z);
    cup.userData.velocity.set(-3, 0, 0);
  });
  await page.clock.runFor(50);
  expect(
    await page.evaluate(
      () =>
        window.__worldTest.floats.find((c) => c.userData.thrown).userData
          .velocity.x,
    ),
  ).toBeGreaterThan(0);
});

test("Reactor warning, shield raycast, single pulse and the elevated bridge work in the live simulation", async ({
  page,
}) => {
  await page.locator('[data-level="7"]').click();
  await start(page);
  await page.evaluate(() => {
    const g = window.__game;
    g.state().elapsed = 13;
    g.world.getPosition(0).set(3, 0.13, 3);
  });
  await page.clock.runFor(150);
  await expect(page.locator("#gravity-label")).toContainText("IMPULSO TRA 3S");
  await expect(page.locator("#announcement strong")).toHaveText(
    "IMPULSO TRA 3",
  );
  await page.clock.runFor(1000);
  await expect(page.locator("#announcement strong")).toHaveText(
    "IMPULSO TRA 2",
  );
  await page.clock.runFor(1000);
  await expect(page.locator("#announcement strong")).toHaveText(
    "IMPULSO TRA 1",
  );
  // Guardare la macchina attraverso la paratia orientale non deve selezionarla.
  await page.evaluate(() => window.__game.world.getPosition(0).set(5, 0.13, 0));
  await aim(page, 0, 3, 1, 0);
  expect(
    await page.evaluate(
      () => window.__game.world.getTarget(0)?.station ?? null,
    ),
  ).toBe(null);
  await page.evaluate(() => {
    const g = window.__game;
    g.world.getPosition(0).set(3, 0.13, 3);
    g.state().elapsed = 15.98;
  });
  await page.clock.runFor(90);
  expect(
    await page.evaluate(() => window.__game.world.getVelocity(0).length()),
  ).toBeGreaterThan(4);
  const velocity = await page.evaluate(() =>
    window.__game.world.getVelocity(0).length(),
  );
  await page.clock.runFor(100);
  expect(
    await page.evaluate(() => window.__game.world.getVelocity(0).length()),
  ).toBeLessThan(velocity + 1);
  await page.evaluate(() => {
    const g = window.__game;
    g.state().elapsed = 28;
    g.world.getPosition(0).set(1.8, 1.43, 5);
  });
  await page.clock.runFor(850);
  expect(
    await page.evaluate(() => window.__game.world.getPosition(0).y),
  ).toBeCloseTo(1.43, 2);
});

test("organic GLB customer instances retain rig clips, independent skins and VIP accessories after pooling", async ({
  page,
}) => {
  await start(page);
  await page.clock.runFor(1200);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__game.world
            .getActors()
            .filter((a) => a.kind === "customer" && a.ready).length,
      ),
    )
    .toBe(6);
  await page.evaluate(() => {
    const g = window.__game;
    g.orders().splice(
      0,
      1,
      g.makeOrder(6, () => 0.5, { elapsed: 50 }),
    );
    g.renderOrders();
  });
  await page.clock.runFor(1200);
  const result = await page.evaluate(() => {
    const c = window.__game.world.getCustomers().find((c) => c.order?.id === 7),
      a = c.body.userData.actor;
    let skin;
    a.model.traverse((n) => {
      for (const m of Array.isArray(n.material)
        ? n.material
        : n.material
          ? [n.material]
          : [])
        if (m.name === "Skin") skin = m;
    });
    return {
      clips: Object.keys(a.actions).sort(),
      scarf: a.model.getObjectByName("VIPScarf").visible,
      cape: a.model.getObjectByName("VIPCape").visible,
      pores: !!skin.roughnessMap,
      roughness: skin.roughness,
    };
  });
  expect(result).toEqual({
    clips: ["Cheer", "Float", "Hurry", "Idle", "Walk"],
    scarf: true,
    cape: true,
    pores: true,
    roughness: 0.48,
  });
});

test("organic barista loads a skinned apron with textile PBR and keeps all five clips", async ({
  page,
}) => {
  await page.locator("#coop").click();
  await start(page);
  await page.clock.runFor(1200);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__game.world
            .getActors()
            .filter((a) => a.kind === "barista" && a.ready).length,
      ),
    )
    .toBe(2);
  const info = await page.evaluate(() =>
    window.__game.world
      .getActors()
      .filter((a) => a.kind === "barista")
      .map((a) => {
        let apron;
        a.model.traverse((n) => {
          for (const m of Array.isArray(n.material)
            ? n.material
            : n.material
              ? [n.material]
              : [])
            if (m.name === "Apron") apron = m;
        });
        return {
          cap: !!a.model.getObjectByName("BaristaCap"),
          clips: Object.keys(a.actions).sort(),
          apron: apron.isMeshPhysicalMaterial,
          sheen: apron.sheen,
          bump: apron.bumpMap.name,
        };
      }),
  );
  for (const actor of info)
    expect(actor).toEqual({
      cap: true,
      clips: ["Cheer", "Float", "Hurry", "Idle", "Walk"],
      apron: true,
      sheen: 0.65,
      bump: "clothBump",
    });
});
