(function () {
    'use strict';

    const ENERGY_MAX = 8;
    const ENERGY_KEY = 'subway_skate_energy_v1';
    let energy = Math.min(ENERGY_MAX, Number(localStorage.getItem(ENERGY_KEY)) || 0);
    let boardPatched = null;
    let previousCoinAwake = null;
    let nextWaveZ = null;
    let airRoute = null;
    let oceanZone = null;
    let elevatedSurface = null;
    const obstacles = [];
    const drops = [];
    const laneXs = [-20, 0, 20];
    let hudFill;
    let hudValue;
    let boardButton;
    let energyCoinSerial = 0;

    function addStyleAndHud() {
        if (document.getElementById('subway-energy-style')) return;
        const style = document.createElement('style');
        style.id = 'subway-energy-style';
        style.textContent = `
            #subway-energy-widget{position:fixed;right:12px;top:96px;z-index:99990;width:116px;padding:9px 10px;border-radius:13px;background:rgba(9,20,35,.84);border:1px solid rgba(76,220,255,.62);color:#fff;font:700 11px Arial,sans-serif;box-shadow:0 4px 20px #00131e80;pointer-events:none}
            #subway-energy-widget .se-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:#b9f4ff}
            #subway-energy-widget .se-track{height:8px;border-radius:8px;background:#263b50;overflow:hidden;box-shadow:inset 0 1px 3px #0008}
            #subway-energy-widget .se-fill{height:100%;width:0;background:linear-gradient(90deg,#00b9fa,#70fff2);border-radius:8px;box-shadow:0 0 9px #00d9ff;transition:width .16s ease}
            #subway-board-button{position:fixed;right:14px;top:146px;z-index:99991;border:1px solid #91f5ff;border-radius:12px;background:#063e62dd;color:white;padding:8px 12px;font:800 11px Arial,sans-serif;box-shadow:0 3px 12px #0018;cursor:pointer}
            #subway-board-button.ready{background:#00a9b8;color:#04131a;box-shadow:0 0 18px #00e5ff}
            #subway-expansion-toast{position:fixed;left:50%;top:20%;transform:translate(-50%,-10px);opacity:0;z-index:100000;padding:10px 15px;border-radius:12px;background:#091523e8;color:#fff;border:1px solid #39dfff;font:800 13px Arial;pointer-events:none;transition:.18s}
            #subway-expansion-toast.show{opacity:1;transform:translate(-50%,0)}
            .se-drop-pop{position:fixed;z-index:99995;pointer-events:none;color:#7af4ff;font:900 15px Arial;text-shadow:0 2px 5px #001}
            @media(max-width:600px){#subway-energy-widget{top:90px;right:6px;width:96px;padding:7px 8px}#subway-board-button{right:7px;top:137px;padding:8px 10px}}
        `;
        document.head.appendChild(style);
        const hud = document.createElement('div');
        hud.id = 'subway-energy-widget';
        hud.innerHTML = '<div class="se-head"><span>⚡ ENERGIA</span><span id="subway-energy-value">0/8</span></div><div class="se-track"><div id="subway-energy-fill" class="se-fill"></div></div>';
        document.body.appendChild(hud);
        boardButton = document.createElement('button');
        boardButton.id = 'subway-board-button';
        boardButton.type = 'button';
        boardButton.textContent = '🛹 PRANCHA · B';
        boardButton.addEventListener('click', activateBoard);
        document.body.appendChild(boardButton);
        const toast = document.createElement('div');
        toast.id = 'subway-expansion-toast';
        document.body.appendChild(toast);
        hudFill = document.getElementById('subway-energy-fill');
        hudValue = document.getElementById('subway-energy-value');
        updateEnergyHud();
    }

    function notify(message) {
        const el = document.getElementById('subway-expansion-toast');
        if (!el) return;
        el.textContent = message;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 1500);
    }

    function storeEnergy() {
        localStorage.setItem(ENERGY_KEY, String(energy));
        updateEnergyHud();
    }

    function updateEnergyHud() {
        if (!hudFill || !hudValue) return;
        hudFill.style.width = `${(energy / ENERGY_MAX) * 100}%`;
        hudValue.textContent = `${energy}/${ENERGY_MAX}`;
        if (boardButton) {
            const hero = window.game && window.game.hero;
            const active = !!(hero && hero.hoverboard && hero.hoverboard.isOn && hero.hoverboard.isOn());
            boardButton.classList.toggle('ready', energy >= ENERGY_MAX || active);
            boardButton.textContent = active ? '🛹 PRANCHA ATIVA' : energy >= ENERGY_MAX ? '🛹 USAR PRANCHA · B' : `🛹 ${energy}/${ENERGY_MAX} · B`;
        }
    }

    function grantEnergy(amount) {
        const hero = window.game && window.game.hero;
        const board = hero && hero.hoverboard;
        if (board && board.isOn && board.isOn()) {
            if (energy < ENERGY_MAX) {
                energy = Math.min(ENERGY_MAX, energy + amount);
                board.count = Math.min((board.count || 0) + 1.2, (board.duration || 30) + 12);
                storeEnergy();
                notify('🛹 +1,2s de prancha');
            }
            return;
        }
        if (energy >= ENERGY_MAX) return;
        energy = Math.min(ENERGY_MAX, energy + amount);
        storeEnergy();
        if (energy === ENERGY_MAX) notify('⚡ PRANCHA CARREGADA! Aperte B');
    }

    function bindCoin(coin) {
        if (!coin) return;
        const proto = Object.getPrototypeOf(coin);
        if (!proto || proto.__subwayEnergyHook || typeof proto.onCollect !== 'function') return;
        const original = proto.onCollect;
        proto.onCollect = function () {
            if (this._isEnergyPickup) {
                this.active = false; this.visible = false;
                if (this.body) { this.body.width = 0; this.body.height = 0; this.body.depth = 0; }
                if (this.model) this.model.active = false;
                try { if (this.game && this.game.sfx && this.game.sfx.play) this.game.sfx.play('pickup-powerup'); } catch (_) {}
                grantEnergy(1);
                return;
            }
            const isDash = this._isDashItem;
            const noCoin = !!window.NO_COIN_MODE;
            const result = original.apply(this, arguments);
            if (!noCoin && !isDash) grantEnergy(1);
            return result;
        };
        proto.__subwayEnergyHook = true;
    }

    function bindCoinAwake() {
        if (previousCoinAwake === window.__onCoinAwake) return;
        previousCoinAwake = window.__onCoinAwake;
        if (typeof previousCoinAwake !== 'function') return;
        window.__onCoinAwake = function (coin) {
            const result = previousCoinAwake.apply(this, arguments);
            if (coin && !coin._isDashItem && !coin.__energyTypeAssigned) {
                coin.__energyTypeAssigned = true;
                energyCoinSerial++;
                coin._isEnergyPickup = energyCoinSerial % 6 === 0;
                if (coin._isEnergyPickup) {
                    if (coin.body) { coin.body.width = 7; coin.body.height = 8; coin.body.depth = 6; }
                    if (coin.model) { setTint(coin.model, 0x00dfff); if (coin.model.scale && coin.model.scale.set) coin.model.scale.set(1.6, 1.6, 1.6); }
                    if (coin.shine) { coin.shine.active = true; if (coin.shine.view) setTint(coin.shine.view, 0x75f7ff); }
                }
            }
            bindCoin(coin);
            return result;
        };
    }

    function patchBoard() {
        const hero = window.game && window.game.hero;
        const board = hero && hero.hoverboard;
        if (!board || boardPatched === board || typeof board.turnOn !== 'function') return;
        boardPatched = board;
        const originalTurnOn = board.turnOn;
        board.turnOn = function () {
            if (this.isOn && this.isOn()) return originalTurnOn.apply(this, arguments);
            if (energy < ENERGY_MAX) { notify(`⚡ Faltam ${ENERGY_MAX - energy} cargas`); return; }
            const oldNoCoin = window.NO_COIN_MODE;
            const oldLocked = this.locked;
            const oldHas = this.hasHoverboards;
            const oldSpend = this.spendHoverboard;
            const paidEnergy = energy;
            try {
                const user = (window.app && window.app.user) || (window.game && window.game.user);
                if (user && !user.board) user.board = 'hoverboard';
                if (this.setBoard && user && user.board) this.setBoard(user.board);
            } catch (_) {}
            energy = 0;
            storeEnergy();
            window.NO_COIN_MODE = false;
            this.locked = false;
            this.hasHoverboards = () => true;
            this.spendHoverboard = () => {};
            try { originalTurnOn.apply(this, arguments); } catch (e) { energy = paidEnergy; storeEnergy(); }
            window.NO_COIN_MODE = oldNoCoin;
            this.locked = oldLocked;
            if (oldHas) this.hasHoverboards = oldHas; else delete this.hasHoverboards;
            if (oldSpend) this.spendHoverboard = oldSpend; else delete this.spendHoverboard;
            if (this.isOn && this.isOn()) notify('🛹 PRANCHA ATIVADA!');
            else { energy = paidEnergy; storeEnergy(); }
            updateEnergyHud();
        };
    }

    function activateBoard() {
        const game = window.game;
        const hero = game && game.hero;
        if (!game || !hero || game.state !== 1) { notify('A prancha pode ser usada durante a corrida'); return; }
        if (energy < ENERGY_MAX) { notify(`⚡ Faltam ${ENERGY_MAX - energy} cargas`); return; }
        patchBoard();
        if (hero.hoverboard && hero.hoverboard.turnOn) hero.hoverboard.turnOn();
    }

    window.addEventListener('keydown', event => {
        if ((event.code === 'KeyB' || event.key.toLowerCase() === 'b') && !event.repeat) {
            event.preventDefault();
            activateBoard();
        }
    }, true);

    function setTint(entity, hex) {
        if (!entity) return;
        try {
            if (entity.view3d && entity.view3d.material) entity.view3d.material.color = hex;
            if (entity.material) entity.material.color = hex;
            for (const child of entity.children || []) setTint(child, hex);
        } catch (_) {}
    }

    function entity(model, x, y, z, scale, color) {
        if (!window.__lib || typeof window.__lib.getEntity !== 'function') return null;
        let obj = null;
        try {
            for (const key of model) {
                try { obj = window.__lib.getEntity(key); } catch (_) { obj = null; }
                if (obj) break;
            }
            if (!obj) return null;
            obj.x = x; obj.y = y; obj.z = z;
            if (obj.scale && obj.scale.set) obj.scale.set(scale[0], scale[1], scale[2]);
            if (color) setTint(obj, color);
            const parent = window.game && window.game.hero && window.game.hero.parent;
            if (!parent) return null;
            parent.addChild(obj);
            return obj;
        } catch (_) { return null; }
    }

    function removeObject(obj) {
        try { if (obj && obj.parent) obj.parent.removeChild(obj); } catch (_) {}
    }

    function spawn(type, x, y, z, options) {
        options = options || {};
        const defs = {
            container: { models: ['train_cargo', 'train_cargo_low', 'dumpster'], scale: [1.0, 0.42, 0.34], color: 0xd84925, width: 20, height: 12, depth: 20 },
            halfTrain: { models: ['train_ramp_low', 'train_subwagon_low', 'blocker_roll'], scale: [0.62, 0.55, 0.42], color: 0x9b5035, width: 24, height: 14, depth: 20 },
            bounceTrain: { models: ['train_standardWagon_low', 'train_standard_low', 'blocker_jump'], scale: [0.72, 0.46, 0.28], color: 0x9e36ff, width: 22, height: 10, depth: 17 },
            drone: { models: ['powerBox', 'dumpster', 'blocker_jump'], scale: [2.0, 1.1, 1.8], color: 0x00dbff, width: 16, height: 14, depth: 14 },
            ramp: { models: ['train_ramp_low', 'blocker_jump'], scale: [0.72, 0.6, 0.42], color: 0xb17b4c, width: 24, height: 12, depth: 22 },
            plank: { models: ['blocker_jump', 'dumpster'], scale: [1.5, 0.55, 1.9], color: 0x79502f, width: 17, height: 5, depth: 18 },
            wall: { models: ['blocker_roll'], scale: [3.7, 0.65, 1.1], color: 0xd8a732, width: 58, height: 10, depth: 8 },
            water: { models: ['powerBox', 'blocker_roll'], scale: [2.8, 0.08, 8], color: 0x6738db, width: 60, height: 1, depth: 40 },
            platform: { models: ['train_cargo_low', 'train_cargo', 'dumpster'], scale: [0.9, 0.3, 0.3], color: 0xd64a27, width: 20, height: 9, depth: 19 },
            energy: { models: ['currency_coin'], scale: [1.7, 1.7, 1.7], color: 0xffc928, width: 6, height: 8, depth: 5 }
        }[type];
        if (!defs) return null;
        const mesh = entity(defs.models, x, y, z, defs.scale, defs.color);
        if (!mesh) return null;
        const parts = [];
        if (type === 'drone') {
            // Compose a new hover drone from game-native 3D pieces and animated rotor coins.
            const rotorOffsets = [[-7, 0, -5], [7, 0, -5], [-7, 0, 5], [7, 0, 5]];
            for (const [rx, ry, rz] of rotorOffsets) {
                const rotor = entity(['currency_coin'], x + rx, y + ry, z + rz, [0.62, 0.18, 0.62], 0x8cf8ff);
                if (rotor) parts.push({ mesh: rotor, offset: [rx, ry, rz] });
            }
        } else if (type === 'bounceTrain') {
            const ring = entity(['currency_coin'], x, y + 9, z, [2.25, 0.2, 2.25], 0xd53cff);
            if (ring) parts.push({ mesh: ring, offset: [0, 9, 0] });
            const arrow = entity(['lightSignal', 'blocker_jump'], x, y + 15, z, [0.42, 0.55, 0.42], 0xd53cff);
            if (arrow) parts.push({ mesh: arrow, offset: [0, 15, 0] });
        } else if (type === 'plank') {
            // Five cross-boards make this a short wooden deck instead of a single generic block.
            for (let index = -2; index <= 2; index++) {
                const board = entity(['blocker_roll', 'train_ramp_low'], x, y + 1.2, z + index * 3.2, [0.92, 0.22, 0.28], 0x76502f);
                if (board) parts.push({ mesh: board, offset: [0, 1.2, index * 3.2] });
            }
        } else if (type === 'water') {
            for (const side of [-1, 1]) {
                const sheet = entity(['powerBox', 'blocker_roll'], x + side * 20, y, z, [2.8, 0.08, 8], 0x6738db);
                if (sheet) parts.push({ mesh: sheet, offset: [side * 20, 0, 0] });
            }
        }
        return { type, x, y, z, mesh, parts, width: defs.width, height: defs.height, depth: defs.depth, phase: Math.random() * Math.PI * 2, baseX: x, baseY: y, options, dead: false, coins: 0 };
    }

    function add(obs) { if (obs) obstacles.push(obs); return obs; }
    function removeObs(obs) { removeObject(obs.mesh); (obs.parts || []).forEach(p => removeObject(p.mesh)); obs.dead = true; }

    function addWaterCourse(startZ, entryLane) {
        const entryIndex = Math.max(0, laneXs.indexOf(entryLane));
        const zone = { from: startZ + 12, to: startZ - 115, platforms: [] };
        add(spawn('ramp', entryLane, 0, startZ + 20, { entry: true }));
        for (let i = 0; i < 5; i++) {
            const lane = laneXs[(entryIndex + i) % 3];
            const z = startZ + 6 - i * 27;
            add(spawn('water', 0, -1.7, z, { zone: true }));
            const p = add(spawn('platform', lane, 3, z, { moving: true, speed: 1.15 + i * 0.12 }));
            if (p) zone.platforms.push(p);
        }
        oceanZone = zone;
        notify('🌊 TRILHOS SOBRE O OCEANO! Pule entre as cargas');
    }

    function addAirCourse(startZ, entryLane) {
        const entryIndex = Math.max(0, laneXs.indexOf(entryLane));
        add(spawn('drone', entryLane, 4, startZ, { takeoff: true }));
        for (let i = 0; i < 5; i++) {
            const lane = laneXs[(entryIndex + i + 1) % 3];
            const p = add(spawn('platform', lane, 15, startZ - 28 * (i + 1), { moving: true, aerial: true, speed: 1.0 }));
            if (p) p.aerial = true;
        }
        add(spawn('drone', laneXs[(entryIndex + 1) % 3], 15, startZ - 168, { landing: true }));
        notify('🚁 Pule no drone para seguir a trilha aérea');
    }

    function spawnWave(z) {
        const roll = Math.random();
        const lane = laneXs[Math.floor(Math.random() * laneXs.length)];
        if (roll < 0.18) {
            addWaterCourse(z, lane);
        } else if (roll < 0.34) {
            const wood = add(spawn('plank', lane, 0, z));
            if (wood) wood.type = 'plank';
        } else if (roll < 0.49) {
            add(spawn('bounceTrain', lane, 0, z));
            const sign = add(spawn('energy', lane, 14, z - 2));
            if (sign) { sign.mesh.ry = Math.PI; sign.mesh.rx = Math.PI; setTint(sign.mesh, 0xd53cff); sign.type = 'bounceAura'; }
        } else if (roll < 0.64) {
            addAirCourse(z, lane);
        } else if (roll < 0.78) {
            const wall = add(spawn('wall', 0, 5, z));
            if (wall) wall.type = 'wall';
        } else if (roll < 0.9) {
            const partial = add(spawn('halfTrain', lane, 0, z));
            if (partial) partial.options.jumpOver = true;
        } else {
            const cargo = add(spawn('container', lane, 0, z, { moving: true, speed: 2.1 }));
            if (cargo) cargo.options.jumpOver = true;
            add(spawn('container', laneXs[(laneXs.indexOf(lane) + 1) % 3], 0, z - 38, { moving: true, speed: 1.4 }));
        }
    }

    function isRolling(hero) {
        return !!(hero && ((hero.character && hero.character.roll && hero.character.roll.active) || (hero.anim && hero.anim.currentAnimationClipName === 'roll') || (hero.roll && hero.roll.isOn && hero.roll.isOn())));
    }

    function die(game, force) {
        try {
            const hero = game && game.hero;
            const board = hero && hero.hoverboard;
            if (board && board.isOn && board.isOn()) {
                if (!force) { if (board.explode) board.explode(); return; }
                board.turnOff();
            }
            if (hero && hero.player && hero.player.die) hero.player.die('train');
            else if (game && game.gameover) game.gameover();
        } catch (_) {}
    }

    function awardDrop(obs, game) {
        if (obs.dead) return;
        if (window.NO_COIN_MODE) {
            removeObs(obs);
            die(game, true);
            return;
        }
        try {
            if (game.stats) game.stats.coins += 1;
            if (game.missions && game.missions.addStat) game.missions.addStat(1, 'mission-pickup-coins');
            if (game.sfx && game.sfx.play) game.sfx.play('pickup-coin', { volume: 0.5 });
        } catch (_) {}
        grantEnergy(1);
        removeObs(obs);
        const pop = document.createElement('div');
        pop.className = 'se-drop-pop'; pop.textContent = '+1 ⚡'; pop.style.left = `${window.innerWidth / 2}px`; pop.style.top = `${window.innerHeight * 0.43}px`;
        document.body.appendChild(pop); setTimeout(() => pop.remove(), 700);
    }

    function activateAirRoute(game, startZ) {
        const hero = game.hero;
        const body = hero && hero.body;
        if (!body || airRoute) return;
        airRoute = { started: performance.now(), duration: 8500, fromGround: Number(body.ground) || 0, endZ: startZ - 168, phase: 'up', lastSupported: performance.now() };
        try {
            if (hero.jump && hero.jump.perform) {
                hero.jump.perform(32, true);
                hero.jump.duration = 1.7;
                hero.jump.time = 0;
                hero.jump.endY = Math.max(hero.jump.endY, 18);
            }
        } catch (_) {}
        notify('🚁 CAMINHO AÉREO · siga as plataformas');
    }

    function updateExpansion() {
        const game = window.game;
        const hero = game && game.hero;
        const body = hero && hero.body;
        if (!game || !hero || !body || !window.__lib) { updateEnergyHud(); return; }
        patchBoard();
        bindCoinAwake();
        if (nextWaveZ === null) nextWaveZ = body.z - 420;
        if (body.z < nextWaveZ) {
            if (Math.random() < 0.6) spawnWave(body.z - 360);
            nextWaveZ = body.z - (360 + Math.random() * 120);
        }

        const now = performance.now();
        const heroX = body.x || 0;
        const heroZ = body.z || 0;
        const heroY = body.y || body.bottom || 0;
        if (elevatedSurface && (elevatedSurface.dead || Math.abs(elevatedSurface.z - heroZ) > 14 || Math.abs(elevatedSurface.x - heroX) > 15)) {
            try { body.ground = 0; } catch (_) {}
            elevatedSurface = null;
        }
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            if (!obs || obs.dead || obs.z > heroZ + 65) {
                if (obs) removeObs(obs);
                obstacles.splice(i, 1);
                continue;
            }
            if (Math.abs(obs.z - heroZ) > 210) continue;
            if (obs.options && obs.options.moving) {
                obs.x = obs.baseX + Math.sin(now * 0.001 * obs.options.speed + obs.phase) * 8;
                obs.mesh.x = obs.x;
            }
            if (obs.type === 'bounceAura') {
                obs.mesh.ry = (obs.mesh.ry || 0) + 0.045;
                obs.mesh.y = obs.baseY + Math.sin(now * 0.004) * 1.5;
            }
            if (obs.type === 'water') {
                obs.mesh.y = obs.baseY + Math.sin(now * 0.002 + obs.phase) * 0.18;
                obs.mesh.ry = (obs.mesh.ry || 0) + 0.0015;
            }
            if (obs.type === 'drone') {
                obs.mesh.ry = (obs.mesh.ry || 0) + 0.025;
                obs.mesh.y = obs.baseY + Math.sin(now * 0.003 + obs.phase) * 1.1;
                (obs.parts || []).forEach((part, index) => {
                    part.mesh.x = obs.mesh.x + part.offset[0];
                    part.mesh.y = obs.mesh.y + part.offset[1] + Math.sin(now * 0.018 + index) * 0.5;
                    part.mesh.z = obs.mesh.z + part.offset[2];
                    part.mesh.ry = (part.mesh.ry || 0) + 0.12;
                });
            }
            if (obs.type === 'bounceTrain') {
                if (obs.used && obs.bounceStarted) {
                    const bounceAge = now - obs.bounceStarted;
                    obs.mesh.y = obs.baseY + Math.sin(Math.min(1, bounceAge / 420) * Math.PI) * 5;
                    obs.mesh.ry = (obs.mesh.ry || 0) + 0.06;
                    if (bounceAge > 450) { removeObs(obs); continue; }
                }
                (obs.parts || []).forEach((part, index) => {
                    part.mesh.x = obs.mesh.x + part.offset[0];
                    part.mesh.z = obs.mesh.z + part.offset[2];
                    part.mesh.y = obs.mesh.y + part.offset[1] + Math.sin(now * 0.004 + index) * 0.45;
                    part.mesh.ry = (part.mesh.ry || 0) + (index === 0 ? 0.08 : 0);
                });
            }
            if (obs.type === 'debris') {
                const age = now - obs.started;
                obs.mesh.y = obs.baseY + age * 0.018;
                obs.mesh.rx = (obs.mesh.rx || 0) + 0.08;
                if (age > 450) removeObs(obs);
                continue;
            }
            if (obs.type === 'energy' || obs.type === 'drop') obs.mesh.ry = (obs.mesh.ry || 0) + 0.07;
            const dz = Math.abs(obs.z - heroZ);
            const dx = Math.abs(obs.x - heroX);
            if (dz > obs.depth / 2 + 3 || dx > obs.width / 2 + 2) continue;
            if (obs.type === 'drop' || obs.type === 'energy') { awardDrop(obs, game); continue; }
            if (obs.type === 'bounceTrain' && heroY > 2.5 && !obs.used) {
                obs.used = true; obs.bounceStarted = now;
                try { hero.jump.perform(38, true); } catch (_) { body.velocity.y = 35; }
                notify('⬆️ BOUNCE!'); continue;
            }
            if (obs.type === 'bounceTrain' && obs.used) continue;
            if ((obs.type === 'platform' && !obs.aerial || obs.type === 'container') && heroY > 2.5 && heroY < 15) {
                try {
                    hero.jump.cancel();
                    body.ground = 8; body.bottom = 8; body.y = 8; body.velocity.y = 0;
                    obs.used = true;
                    elevatedSurface = obs;
                } catch (_) {}
                continue;
            }
            if (obs.type === 'drone' && obs.options.takeoff && heroY > 2.5 && !obs.used) {
                obs.used = true; activateAirRoute(game, obs.z); removeObs(obs); continue;
            }
            if (obs.type === 'drone' && obs.options.landing && airRoute && heroY > 4 && !obs.used) {
                airRoute.phase = 'down';
                airRoute.downStarted = now;
                airRoute.downFrom = heroY;
                obs.used = true;
                removeObs(obs);
                notify('🚁 Drone de descida!');
                continue;
            }
            const boardActive = !!(hero.hoverboard && hero.hoverboard.isOn && hero.hoverboard.isOn());
            if (obs.type === 'plank' && (heroY > 2.5 || boardActive)) {
                removeObs(obs);
                if (window.NO_COIN_MODE) {
                    die(game, true);
                    continue;
                }
                for (let n = -1; n <= 1; n++) {
                    const shard = add(spawn('plank', obs.x + n * 4, 1 + Math.random() * 2, obs.z, {}));
                    if (shard) { shard.type = 'debris'; shard.started = now; shard.baseY = shard.mesh.y; shard.mesh.rx = Math.random(); }
                }
                for (let n = -1; n <= 1; n++) {
                    const drop = add(spawn('energy', obs.x + n * 5, 5, obs.z - 4 - Math.abs(n) * 2));
                    if (drop) drop.type = 'drop';
                }
                try { if (navigator.vibrate) navigator.vibrate(18); } catch (_) {}
                continue;
            }
            if (obs.type === 'wall' && isRolling(hero)) { removeObs(obs); continue; }
            if (obs.type === 'wall') { die(game, true); return; }
            if (obs.type === 'halfTrain' && heroY > 5) continue;
            if (obs.type === 'wall' || obs.type === 'plank' || obs.type === 'bounceTrain' || obs.type === 'drone' || obs.type === 'container' || obs.type === 'halfTrain' || obs.type === 'platform') {
                if (obs.type === 'drone' && obs.options.landing && airRoute) continue;
                die(game); return;
            }
        }

        if (oceanZone && heroZ <= oceanZone.from && heroZ >= oceanZone.to) {
            const platform = oceanZone.platforms.some(p => !p.dead && Math.abs(p.z - heroZ) < 13 && Math.abs(p.x - heroX) < 12);
            if (!platform && heroY < 2) { notify('🌊 Você caiu no oceano'); die(game, true); return; }
        } else if (oceanZone && heroZ < oceanZone.to - 15) {
            oceanZone = null;
            try { body.ground = 0; body.bottom = 0; body.y = 0; body.velocity.y = 0; } catch (_) {}
        }

        if (airRoute) {
            const elapsed = now - airRoute.started;
            const onAirPlatform = obstacles.some(p => p.type === 'platform' && p.aerial && !p.dead && Math.abs(p.z - heroZ) < 16 && Math.abs(p.x - heroX) < 13);
            if (airRoute.phase === 'down') {
                const t = Math.min(1, (now - airRoute.downStarted) / 550);
                try { body.ground = 0; body.bottom = airRoute.downFrom * (1 - t); body.y = body.bottom; body.velocity.y = 0; } catch (_) {}
                if (t >= 1) { airRoute = null; notify('🛬 Pouso concluído'); }
            } else if (elapsed < airRoute.duration) {
                if (heroY < 2 && !onAirPlatform) { airRoute = null; notify('⬇️ Você saiu da trilha aérea'); die(game, true); return; }
                if (onAirPlatform && heroY < 6) {
                    try {
                        hero.jump.cancel();
                        body.ground = 12; body.bottom = 12; body.y = 12; body.velocity.y = 0;
                        airRoute.lastSupported = now;
                    } catch (_) {}
                } else if (!onAirPlatform && body.ground === 12) {
                    body.ground = airRoute.fromGround;
                    if (now - airRoute.lastSupported > 600) { airRoute = null; notify('⬇️ Você perdeu a plataforma aérea'); die(game, true); return; }
                }
            } else {
                airRoute.phase = 'down';
                airRoute.downStarted = now;
                airRoute.downFrom = heroY;
                notify('🚁 Drone de descida · pouso');
            }
        }
        updateEnergyHud();
    }

    function resetExpansion() {
        for (const obs of obstacles) removeObs(obs);
        obstacles.length = 0; drops.length = 0; oceanZone = null; airRoute = null; elevatedSurface = null; nextWaveZ = null;
        energy = 0; storeEnergy();
    }

    function init() {
        addStyleAndHud();
        setInterval(updateExpansion, 30);
        window.addEventListener('john-surf-run-end', resetExpansion);
        window.addEventListener('john-surf-run-start', () => { nextWaveZ = null; });
        const previousGameOver = window.__onGameOver;
        window.__onGameOver = function () { if (typeof previousGameOver === 'function') previousGameOver.apply(this, arguments); resetExpansion(); };
        const previousReset = window.__onGameReset;
        window.__onGameReset = function () { if (typeof previousReset === 'function') previousReset.apply(this, arguments); resetExpansion(); };
        setInterval(bindCoinAwake, 100);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
