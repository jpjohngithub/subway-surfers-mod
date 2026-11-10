/**
 * Subway Surfers Ultra Mod & Real-Time Online Multiplayer Engine
 * 100% Complete Implementation:
 * - Modo Ilimitado (Moedas e Chaves Infinitas, Todos os Personagens, Pranchas e Roupas, Melhorias Max, Loja Grátis)
 * - Modo No Coin (Moeda Vermelha com Hitbox 100% Precisa sem Magnetismo, Morte Instantânea)
 * - Timer Minimalista (Aparece e funciona APENAS durante a corrida ativa)
 * - Menu Unificado (Modo de Jogo, Modo Online e Recordes em uma única interface)
 * - Modo Online Real (MQTT WebSockets global, Lobby com Jogadores Online, Convites, Grupo 2-4, Sistema Pronto, Fantasmas Transparentes, Classificação em Tempo Real, Modo Espectador)
 * - Remoção do Badge Powered by Netlify
 */
(function() {
    'use strict';

    // ==========================================
    // 0. NETLIFY BADGE & DRAWER REMOVER
    // ==========================================
    function nukeNetlifyBadge() {
        try {
            const badElements = document.querySelectorAll(
                '#nl-badge-frame, iframe[title*="Netlify"], iframe[srcdoc*="Netlify"], script[src*=".netlify/scripts"], [data-netlify-site-id], [data-nf-variant], [class*="netlify"], [id*="netlify"], [href*="netlify.com"], netlify-drawer, #netlify-drawer, .netlify-badge, iframe[src*="netlify"]'
            );
            badElements.forEach(el => el.remove());
            document.querySelectorAll('div, a, span, button, p, iframe').forEach(el => {
                if ((el.textContent && el.textContent.toLowerCase().includes('powered by netlify')) ||
                    (el.title && el.title.toLowerCase().includes('netlify'))) {
                    el.remove();
                }
            });
        } catch(e) {}
    }
    nukeNetlifyBadge();
    const netlifyObserver = new MutationObserver(nukeNetlifyBadge);
    netlifyObserver.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(nukeNetlifyBadge, 250);

    // ==========================================
    // 1. DATA & CONSTANTS
    // ==========================================
    const ALL_CHARACTERS = [
        'jake', 'tricky', 'yutani', 'lucy', 'tagbot', 'ninja', 'tasha', 'king', 'brody'
    ];

    const ALL_BOARDS = [
        'hoverboard', 'starboard', 'bouncer', 'lowrider', 'greatwhite',
        'monster', 'hotrod', 'daredevil', 'lumberjack', 'bigkahuna',
        'sunset', 'teleporter', 'freestyler', 'skullfire', 'scoot',
        'superhero', 'windglider'
    ];

    const ALL_OUTFITS = [
        'jake_outfit1', 'jake_outfit2', 'tricky_outfit1', 'tricky_outfit2',
        'fresh_outfit1', 'fresh_outfit2', 'spike_outfit1', 'spike_outfit2',
        'frank_outfit1', 'frank_outfit2', 'frizzy_outfit1', 'frizzy_outfit2',
        'king_outfit1', 'king_outfit2', 'lucy_outfit1', 'lucy_outfit2',
        'ninja_outfit1', 'ninja_outfit2', 'tagbot_outfit1', 'tagbot_outfit2',
        'tasha_outfit1', 'tasha_outfit2', 'zoe_outfit1', 'zoe_outfit2',
        'brody_outfit1', 'brody_outfit2'
    ];

    const DEFAULT_AVATARS = [
        { id: 'jake', name: 'Jake', url: 'assets/preload/splash.png' },
        { id: 'tricky', name: 'Tricky', url: 'assets/images/app-icon-16.png' },
        { id: 'lucy', name: 'Lucy', url: 'assets/preload/splash.png' },
        { id: 'ninja', name: 'Ninja', url: 'assets/images/app-icon-16.png' },
        { id: 'king', name: 'King', url: 'assets/preload/splash.png' }
    ];

    // ==========================================
    // 2. STATE MANAGEMENT
    // ==========================================
    window.UNLIMITED_MODE = localStorage.getItem('subway_unlimited_v2') === 'true'; // Default OFF
    function resetUnlimitedStorage() {
        try {
            const gs = JSON.parse(localStorage.getItem('gameSettings') || '{}');
            if (gs.currencies && gs.currencies.coins >= 999999999) {
                gs.currencies = { coins: 0, keys: 0 };
                localStorage.setItem('gameSettings', JSON.stringify(gs));
                localStorage.removeItem('shopSettings');
            }
        } catch(e) {}
    }
    if (!window.UNLIMITED_MODE) resetUnlimitedStorage();
    window.GAME_MODE = localStorage.getItem('subway_game_mode') || 'normal'; // 'normal' | 'nocoin'
    window.NO_COIN_MODE = (window.GAME_MODE === 'nocoin');

    let runTimerInterval = null;
    let runStartTime = 0;
    let runElapsedTime = 0;
    let isRunActive = false;
    let deathFrozen = false;
    let frozenAt = 0;
    let isGamePaused = false;
    let pauseStartedAt = 0;

    // Local profile
    let myProfile = JSON.parse(localStorage.getItem('subway_surfers_profile') || 'null');
    if (myProfile && myProfile.avatar && myProfile.avatar.includes('app-icon-') && !myProfile.avatar.includes('app-icon-16')) {
        myProfile.avatar = DEFAULT_AVATARS[0].url;
        localStorage.setItem('subway_surfers_profile', JSON.stringify(myProfile));
    }
    if (!myProfile || !myProfile.id) {
        const randId = 'user_' + Math.random().toString(36).substr(2, 6);
        const randNum = Math.floor(100 + Math.random() * 900);
        myProfile = {
            id: randId,
            nick: 'Surfer' + randNum,
            avatar: DEFAULT_AVATARS[0].url
        };
        localStorage.setItem('subway_surfers_profile', JSON.stringify(myProfile));
    }

    
    // ==========================================
    // GRAPHICS, ANTI-ALIASING, SATURATION & UNLIMITED FPS
    // ==========================================
    
    // ==========================================
    // ZERO-DELAY INSTANT TOUCH & INPUT ENGINE
    // ==========================================
    window.__swipeT = 7; // Ultra-sensitive swipe threshold (7px instead of 22px)

    // Ultra-responsive native swipe threshold
    window.__swipeT = 9;

    // Zero-delay keyboard response (WASD & Arrows) without hijacking touch
    window.addEventListener('keydown', function(e) {
        const g = window.game || (window.app && window.app.game);
        const ctrl = g && g.controls;
        if (!ctrl) return;
        if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
            if (ctrl.onSwipeHorizontal) ctrl.onSwipeHorizontal.dispatch(-1);
        } else if (e.key === 'ArrowRight' || e.code === 'KeyD') {
            if (ctrl.onSwipeHorizontal) ctrl.onSwipeHorizontal.dispatch(1);
        } else if (e.key === 'ArrowUp' || e.code === 'KeyW' || e.key === ' ') {
            if (ctrl.onSwipeVertical) ctrl.onSwipeVertical.dispatch(1);
        } else if (e.key === 'ArrowDown' || e.code === 'KeyS') {
            if (ctrl.onSwipeVertical) ctrl.onSwipeVertical.dispatch(-1);
        }
    }, true);

    const GFX_SETTINGS = {
        fps: localStorage.getItem('sw_fps') || 'unlimited', // '60' | '120' | 'unlimited'
        saturation: parseInt(localStorage.getItem('sw_saturation') || '100', 10), // 50 - 200
        smoothAnim: localStorage.getItem('sw_smooth_anim') !== 'false'
    };

    // IMMEDIATELY apply stored saturation to root on script load so F5 NEVER resets!
    try {
        document.documentElement.style.setProperty('--game-saturation', GFX_SETTINGS.saturation + '%');
    } catch(e) {}

    function applyGraphicsSettings() {
        const satVal = GFX_SETTINGS.saturation || 100;
        // Unconditionally set CSS custom property on root
        document.documentElement.style.setProperty('--game-saturation', satVal + '%');

        // If canvas is already mounted, apply filter directly as well
        const canvas = document.querySelector('#game-canvas') || (window.app && window.app.view) || document.querySelector('canvas');
        if (canvas) {
            canvas.style.filter = `saturate(${satVal}%)`;
        }

        // 2. Ultra-Fluid Framerate (Unlock Pixi Ticker FPS for 120Hz / 144Hz screens)
        if (window.app && window.app.ticker) {
            if (GFX_SETTINGS.fps === 'unlimited') {
                window.app.ticker.maxFPS = 0; // 0 = unlimited FPS in Pixi Ticker
            } else {
                window.app.ticker.maxFPS = parseInt(GFX_SETTINGS.fps, 10) || 60;
            }
            window.app.ticker.minFPS = 10;
        }

        // 3. Smooth Hero Character Skeletal Animation & Scene Clock
        optimizeHeroAnimAndFluidity();
    }

    function optimizeHeroAnimAndFluidity() {
        try {
            const hero = (window.game && window.game.hero) || (window.app && window.app.game && window.app.game.hero);
            if (hero && hero.character && hero.character.anim) {
                if (GFX_SETTINGS.smoothAnim) {
                    hero.character.anim.mixRatio = 0.15; // Silky smooth transitions
                    if (hero.character.anim.currentController) {
                        hero.character.anim.currentController.allowMixing = true;
                    }
                }
            }
            const scene = (window.game && window.game.scene) || (window.app && window.app.scene);
            if (scene && scene.time) {
                scene.time.maxDeltaTime = 30; // Prevents frame hitching spikes
            }
        } catch(e) {}
    }

    window.__cycleFPS = function() {
        const order = ['unlimited', '60', '120'];
        const curIdx = order.indexOf(GFX_SETTINGS.fps);
        GFX_SETTINGS.fps = order[(curIdx + 1) % order.length];
        localStorage.setItem('sw_fps', GFX_SETTINGS.fps);
        applyGraphicsSettings();
        const el = document.getElementById('val-gfx-fps');
        if (el) el.textContent = GFX_SETTINGS.fps === 'unlimited' ? 'Ilimitado (120Hz+)' : (GFX_SETTINGS.fps + ' FPS');
        showHUDNotification('Taxa de FPS: ' + (GFX_SETTINGS.fps === 'unlimited' ? 'Ilimitado' : GFX_SETTINGS.fps + ' FPS'));
    };

    window.__setSaturation = function(val) {
        GFX_SETTINGS.saturation = Math.max(50, Math.min(200, parseInt(val, 10) || 100));
        localStorage.setItem('sw_saturation', String(GFX_SETTINGS.saturation));
        document.documentElement.style.setProperty('--game-saturation', GFX_SETTINGS.saturation + '%');

        const canvas = document.querySelector('#game-canvas') || (window.app && window.app.view) || document.querySelector('canvas');
        if (canvas) {
            canvas.style.filter = `saturate(${GFX_SETTINGS.saturation}%)`;
        }

        const el = document.getElementById('val-gfx-saturation');
        if (el) {
            let desc = GFX_SETTINGS.saturation + '%';
            if (GFX_SETTINGS.saturation === 100) desc += ' (Padrão)';
            else if (GFX_SETTINGS.saturation >= 150) desc += ' (Intenso)';
            else if (GFX_SETTINGS.saturation <= 75) desc += ' (Suave)';
            el.textContent = desc;
        }
        const s = document.getElementById('slider-saturation');
        if (s && s.value != GFX_SETTINGS.saturation) s.value = GFX_SETTINGS.saturation;
    };

    window.__toggleSmoothAnim = function() {
        GFX_SETTINGS.smoothAnim = !GFX_SETTINGS.smoothAnim;
        localStorage.setItem('sw_smooth_anim', GFX_SETTINGS.smoothAnim);
        optimizeHeroAnimAndFluidity();
        const el = document.getElementById('val-gfx-smooth');
        if (el) el.textContent = GFX_SETTINGS.smoothAnim ? 'Ativada (120Hz Interpolação)' : 'Padrão (60Hz)';
        showHUDNotification('Fluidez da Animação: ' + (GFX_SETTINGS.smoothAnim ? 'Ativada' : 'Desativada'));
    };

// Multiplayer State
    const MP = {
        active: false,
        mqtt: null,
        broadcast: null,
        roomId: 'room_' + myProfile.id,
        currentRoomTopic: 'subwaysurf/room/room_' + myProfile.id,
        party: [{ ...myProfile, ready: false, isLeader: true }],
        isPartyLeader: true,
        isReady: false,
        inMatch: false,
        matchType: '1v1', // '1v1' | 'tournament'
        onlinePlayers: new Map(), // id -> { profile, lastSeen }
        playersState: new Map(),  // id -> { x, y, z, anim, alive, score, time }
        placement: [],           // [{ id, nick, avatar, alive, time }]
        spectatingId: null,
        aliveCount: 0
    };

    // ==========================================
    // 3. MODO ILIMITADO (TUDO LIBERADO)
    // ==========================================
    function applyUnlimitedStorage() {
        if (!window.UNLIMITED_MODE) return;
        try {
            const shopSettings = {
                purchased: {
                    characters: ALL_CHARACTERS.slice(),
                    boards: ALL_BOARDS.slice(),
                    outfits: ALL_OUTFITS.slice(),
                    boosts: {
                        consumables: {
                            hoverboard: 999999,
                            mysteryBox: 999999,
                            scoreBooster: 999999,
                            headstart: 999999
                        },
                        permanents: {
                            jetpack: 6,
                            sneakers: 6,
                            magnet: 6,
                            multiplier: 6
                        }
                    }
                }
            };
            localStorage.setItem('shopSettings', JSON.stringify(shopSettings));

            const existingGameSettings = JSON.parse(localStorage.getItem('gameSettings') || '{}');
            existingGameSettings.currencies = { coins: 999999999, keys: 999999999 };
            existingGameSettings.highscore = Math.max(existingGameSettings.highscore || 0, 9999999);
            existingGameSettings.tutorial = true;
            localStorage.setItem('gameSettings', JSON.stringify(existingGameSettings));

            const charSettings = JSON.parse(localStorage.getItem('characterSettings') || '{}');
            if (!charSettings.name || !ALL_CHARACTERS.includes(charSettings.name)) {
                charSettings.name = 'jake';
                charSettings.outfit = 0;
                localStorage.setItem('characterSettings', JSON.stringify(charSettings));
            }
        } catch(e) {}
    }
    applyUnlimitedStorage();

    function applyUnlockToUser(user) {
        if (!user || !window.UNLIMITED_MODE) return;
        try {
            if (user.gameSettings && user.gameSettings.currencies) {
                user.gameSettings.currencies.coins = 999999999;
                user.gameSettings.currencies.keys = 999999999;
            }
            user.coins = 999999999;
            user.keys = 999999999;

            if (user.shopSettings && user.shopSettings.purchased) {
                user.shopSettings.purchased.characters = ALL_CHARACTERS.slice();
                user.shopSettings.purchased.boards = ALL_BOARDS.slice();
                user.shopSettings.purchased.outfits = ALL_OUTFITS.slice();
                user.shopSettings.purchased.boosts = {
                    consumables: {
                        hoverboard: 999999,
                        mysteryBox: 999999,
                        scoreBooster: 999999,
                        headstart: 999999
                    },
                    permanents: {
                        jetpack: 6,
                        sneakers: 6,
                        magnet: 6,
                        multiplier: 6
                    }
                };
            }
        } catch(e) {}
    }

    // Free Shop Hook (Everything costs 0)
    function patchShopItems(shop) {
        if (!shop || !window.UNLIMITED_MODE) return;
        try {
            if (shop.items) {
                Object.values(shop.items).forEach(item => {
                    if (item) {
                        item.cost = 0;
                        item.unlocked = true;
                    }
                });
            }
        } catch(e) {}
    }

    // Continuous unlock maintenance
    setInterval(() => {
        if (!window.UNLIMITED_MODE) return;
        applyUnlimitedStorage();
        if (window.app && window.app.user) {
            applyUnlockToUser(window.app.user);
        }
        if (window.app && window.app.shop) {
            patchShopItems(window.app.shop);
        }
    }, 1000);

    // ==========================================
    // 4. PERFORMANCE & UNLIMITED FPS
    // ==========================================
    try {
        if (window.requestAnimationFrame) {
            const origRAF = window.requestAnimationFrame;
            window.requestAnimationFrame = function(cb) {
                return origRAF(cb);
            };
        }
    } catch(e) {}

    // ==========================================
    // 5. NO COIN MODE & PRECISE HITBOX ENGINE
    // ==========================================
    let lastDashZ = 999999;
    let lastDashLaneX = 0;
    let coinSpawnCounter = 0;
    let dashInvulnUntil = 0;
    window.__dashSpeedMult = 1.0;

    function setEntityHexColor(obj, hexColor) {
        if (!obj) return;
        try {
            if (obj.view3d && obj.view3d.material) {
                obj.view3d.material.color = hexColor;
            }
            if (obj.material) {
                obj.material.color = hexColor;
            }
            if (obj.parts) {
                const partsArr = Array.isArray(obj.parts) ? obj.parts : Object.values(obj.parts);
                for (let i = 0; i < partsArr.length; i++) setEntityHexColor(partsArr[i], hexColor);
            }
            const children = obj.children || (obj.container && obj.container.children);
            if (children && children.length) {
                for (let i = 0; i < children.length; i++) {
                    setEntityHexColor(children[i], hexColor);
                }
            }
        } catch(e) {}
    }

    // ==========================================
    // SKATE ENERGY & HOVERBOARD SYSTEM
    // ==========================================
    const ENERGY_MAX = 8;
    let skateEnergy = 0;
    let lastEnergyTickTime = 0;

    function storeEnergy() {
        updateEnergyHud();
    }

    function showEnergyToast(msg) {
        let el = document.getElementById('subway-expansion-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'subway-expansion-toast';
            document.body.appendChild(el);
        }
        el.innerHTML = msg;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 1100);
    }

    function updateEnergyHud() {
        const fill = document.getElementById('subway-energy-fill');
        const val = document.getElementById('subway-energy-value');
        const widget = document.getElementById('subway-energy-widget');
        const dots = document.querySelectorAll('#subway-energy-widget .se-dot');
        const hero = window.game && window.game.hero;
        const active = !!(hero && hero.hoverboard && hero.hoverboard.isOn && hero.hoverboard.isOn());
        
        if (val) val.textContent = `${skateEnergy}/${ENERGY_MAX}`;
        dots.forEach((dot, idx) => {
            dot.classList.toggle('filled', idx < skateEnergy);
        });
        if (widget) {
            widget.classList.toggle('is-ready', skateEnergy >= ENERGY_MAX);
            widget.classList.toggle('is-active', active);
            widget.title = active ? 'Skate ativo (+1.2s)' : (skateEnergy >= ENERGY_MAX ? 'Skate pronto · Toque ou aperte B' : `Energia: ${skateEnergy}/${ENERGY_MAX}`);
        }
    }

    function grantEnergy(amount = 1) {
        const hero = window.game && window.game.hero;
        const board = hero && hero.hoverboard;
        if (board && board.isOn && board.isOn()) {
            board.count = Math.min((board.count || 0) + 1.2, (board.duration || 30) + 12);
            showEnergyToast('🛹 +1.2s');
            return;
        }
        if (skateEnergy >= ENERGY_MAX) return;
        skateEnergy = Math.min(ENERGY_MAX, skateEnergy + amount);
        storeEnergy();
        if (skateEnergy === ENERGY_MAX) showEnergyToast('🛹 PRONTO [B]');
    }

    function activateBoard() {
        const game = window.game;
        const hero = game && game.hero;
        const board = hero && hero.hoverboard;
        if (!game || !hero || game.state !== 1) {
            showEnergyToast('NA CORRIDA');
            return;
        }
        if (board && board.isOn && board.isOn()) return;
        if (skateEnergy < ENERGY_MAX) {
            showEnergyToast(`⚡ ${skateEnergy}/${ENERGY_MAX}`);
            return;
        }
        skateEnergy = 0;
        storeEnergy();
        try {
            const user = (window.app && window.app.user) || (window.game && window.game.user);
            if (user && !user.board) user.board = 'hoverboard';
            if (board.setBoard && user && user.board) board.setBoard(user.board);
            const oldNoCoin = window.NO_COIN_MODE;
            const oldLocked = board.locked;
            const oldHas = board.hasHoverboards;
            const oldSpend = board.spendHoverboard;
            window.NO_COIN_MODE = false;
            board.locked = false;
            board.hasHoverboards = () => true;
            board.spendHoverboard = () => {};
            board.turnOn();
            window.NO_COIN_MODE = oldNoCoin;
            board.locked = oldLocked;
            if (oldHas) board.hasHoverboards = oldHas; else delete board.hasHoverboards;
            if (oldSpend) board.spendHoverboard = oldSpend; else delete board.spendHoverboard;
            showEnergyToast('🛹 ATIVADO');
        } catch(e) {
            skateEnergy = ENERGY_MAX;
            storeEnergy();
        }
        updateEnergyHud();
    }

    window.addEventListener('keydown', function(event) {
        if ((event.code === 'KeyB' || event.key.toLowerCase() === 'b') && !event.repeat) {
            activateBoard();
        }
    }, true);

    // Called on every coin spawn/awake from patched dependencies.bundle.js
    window.__activeCoins = new Set();

    window.__onCoinAwake = function(coin) {
        if (!coin) return;
        if (!window.__activeCoins) window.__activeCoins = new Set();
        window.__activeCoins.add(coin);
        const isNoCoin = !!window.NO_COIN_MODE;
        coin._isDashItem = false;
        if (coin.hasOwnProperty('onCollect')) {
            delete coin.onCollect;
        }
        delete coin._dashHookAttached;
        coin.visible = true;
        if (coin.model && coin.model.scale) {
            coin.model.scale.set(1, 1, 1);
        }

        const coinZ = coin.body ? coin.body.z : (coin.z || 0);
        const coinX = coin.body ? coin.body.x : (coin.x || 0);
        coinSpawnCounter++;

        // Spawn collectible GREEN Dash Boost Coin on the map lanes every ~18 coins
        if (coinSpawnCounter % 18 === 0 && Math.abs(coinZ - lastDashZ) > 160) {
            coin._isDashItem = true;
            lastDashZ = coinZ;
            lastDashLaneX = coinX;
            if (coin.body) {
                coin.body.width = 6.2;
                coin.body.height = 6.2;
                coin.body.depth = 6.2;
            }
            if (coin.model) {
                setEntityHexColor(coin.model, 0x00ff66); // Pure vibrant neon green!
                if (coin.model.scale && coin.model.scale.set) coin.model.scale.set(1.45, 1.45, 1.45);
            }
            if (coin.shine) {
                coin.shine.active = true;
                if (coin.shine.view) setEntityHexColor(coin.shine.view, 0x00ff66);
            }
            return;
        }

        // In No Coin Mode, regular coins are 100% RED with exact zero-magnetism hitbox
        if (isNoCoin) {
            if (coin.attractable) {
                coin.attractable.active = false;
                coin.attractable.attracted = false;
                coin.attractable.update = function() {};
                coin.attractable.attractionStart = function() {};
            }
            if (coin.body) {
                coin.body.width = 3.6;
                coin.body.height = 3.6;
                coin.body.depth = 3.6;
            }
            if (coin.model) {
                setEntityHexColor(coin.model, 0xff1e1e);
            }
            if (coin.shine) {
                coin.shine.active = false;
            }
            return;
        }

        // Normal Mode: standard native golden coins
        if (coin.body) {
            coin.body.width = 5.0;
            coin.body.height = 5.0;
            coin.body.depth = 5.0;
        }
        if (coin.model) {
            setEntityHexColor(coin.model, 0xffffff);
        }
        if (coin.shine) {
            coin.shine.active = true;
            if (coin.shine.view) setEntityHexColor(coin.shine.view, 0xffffff);
        }
    };

    // Called when player collects a Dash boost item on the map
    window.__onDashCollect = function(coin) {
        dashInvulnUntil = Date.now() + 750;
        window.__dashSpeedMult = Math.min((window.__dashSpeedMult || 1.0) + 0.14, 1.95);

        // Boost de tempo adicional (APENAS no modo online ativo)
        if (MP.inMatch && MPX.roundActive && !MPX.isPracticing && isRunActive && !deathFrozen) {
            const timeBonusMs = 5000; // +5.000s de bônus no tempo da corrida
            runStartTime -= timeBonusMs;
            runElapsedTime += timeBonusMs;
            MPX.live[myProfile.id] = runElapsedTime;
            sendMultiplayerRunnerSync();

            // Floating feedback banner (+5s)
            try {
                const pop = document.createElement('div');
                pop.className = 'subway-boost-time-pop';
                pop.innerHTML = '+5.0s ⚡'; showEnergyToast('🚀 BOOST');
                document.body.appendChild(pop);
                setTimeout(() => pop.remove(), 700);
            } catch(e) {}
        }

        try {
            const g = (coin && coin.game) || window.game;
            if (g) {
                if (g.sfx && g.sfx.play) g.sfx.play('pickup-powerup');
                if (g.hero) {
                    if (g.hero.popPickup && g.hero.popPickup.play) g.hero.popPickup.play();
                    if (g.hero.body) {
                        const baseSpd = (g.stats && g.stats.speed) ? g.stats.speed : 1.2;
                        g.hero.body.velocity.z = -baseSpd * 2.8;
                        g.hero.body.z -= 45;
                    }
                }
            }
            const fx = document.createElement('div');
            fx.className = 'subway-dash-burst';
            document.body.appendChild(fx);
            setTimeout(() => fx.remove(), 450);
        } catch(e) {}
    };

    function triggerCoinShatter(coin) {
        try { if (navigator.vibrate) navigator.vibrate(25); } catch(e) {}

        // Subtle micro-shake
        try {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const rx = (Math.random() - 0.5) * 5;
                const ry = (Math.random() - 0.5) * 5;
                canvas.style.transform = `translate(${rx}px, ${ry}px)`;
                setTimeout(() => { canvas.style.transform = ''; }, 60);
            }
        } catch(e) {}

        // Visual shatter / impact burst
        try {
            let screenX = window.innerWidth / 2;
            let screenY = window.innerHeight * 0.62;
            if (coin && coin.body && typeof coin.body.x === 'number') {
                if (coin.body.x < -10) screenX = window.innerWidth * 0.35;
                else if (coin.body.x > 10) screenX = window.innerWidth * 0.65;
            }

            const container = document.createElement('div');
            container.className = 'subway-shatter-burst';
            container.style.left = screenX + 'px';
            container.style.top = screenY + 'px';
            container.innerHTML = `
                <div class="shatter-flash"></div>
                <div class="shatter-ring"></div>
                <div class="shatter-shard s1"></div>
                <div class="shatter-shard s2"></div>
                <div class="shatter-shard s3"></div>
                <div class="shatter-shard s4"></div>
                <div class="shatter-shard s5"></div>
                <div class="shatter-shard s6"></div>
            `;
            document.body.appendChild(container);
            setTimeout(() => container.remove(), 380);
        } catch(e) {}
    }

    // Called when player touches a coin in No Coin Mode
    window.__onNoCoinCollect = function(coin) {
        if (!window.NO_COIN_MODE) return;
        if (Date.now() < dashInvulnUntil) {
            triggerCoinShatter(coin);
            return;
        }
        if (coin && coin._isDashItem) return;
        if (coin && coin.attractable && coin.attractable.attracted) return;
        triggerNoCoinDeath(coin);
    };

    function triggerNoCoinDeath(coin) {
        const g = (coin && coin.game) || window.game;
        if (!g) return;

        // Visual death flash only (NO red coin message banner!)
        const flash = document.createElement('div');
        flash.className = 'subway-death-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 350);

        try {
            if (g.hero && g.hero.hoverboard && g.hero.hoverboard.isOn && g.hero.hoverboard.isOn()) {
                g.hero.hoverboard.turnOff();
            }
            if (g.hero && g.hero.player && g.hero.player.die) {
                g.hero.player.die('train');
            } else if (g.gameover) {
                g.gameover();
            }
        } catch(e) {}

        stopRunTimer();
    }

    function showHUDNotification(msg) {
        const el = document.createElement('div');
        el.className = 'subway-hud-alert';
        el.innerHTML = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2600);
    }

    // ==========================================
    // 6. MINIMALIST TOP TIMER & RECORDS SYSTEM
    // ==========================================
    function formatTime(ms) {
        const totalSec = Math.floor(ms / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const hundredths = Math.floor((ms % 1000) / 10);
        const mm = String(mins).padStart(2, '0');
        const ss = String(secs).padStart(2, '0');
        const hh = String(hundredths).padStart(2, '0');
        return mm + ':' + ss + '.' + hh;
    }

    function startRunTimer() {
        window.startRunTimer = startRunTimer;
        if (isRunActive) return;
        isRunActive = true;
        deathFrozen = false;
        isGamePaused = false;
        pauseStartedAt = 0;
        runStartTime = performance.now();
        lastEnergyTickTime = performance.now();
        runElapsedTime = 0;
        window.__dashSpeedMult = 1.0;
        lastDashZ = 999999;

        try {
            if (window.game && window.game.hero && window.game.hero.player) {
                window.game.hero.player.hoverboardLocked = !!window.NO_COIN_MODE;
            }
        } catch(e) {}

        const timerWrap = document.getElementById('subway-top-timer-wrap');
        const timerVal = document.getElementById('subway-top-timer-val');
        updateModeBadgeUI();
        document.body.classList.add('sw-in-run');
        
        if (timerWrap) timerWrap.style.display = 'flex';
        if (timerVal) {
            const prevTotal = (MP.inMatch && MPX.totals) ? (MPX.totals[myProfile.id] || 0) : 0;
            timerVal.textContent = formatTime(prevTotal);
        }

        clearInterval(runTimerInterval);
        runTimerInterval = setInterval(() => {
            if (isRunActive && !deathFrozen && !isGamePaused) {
                runElapsedTime = performance.now() - runStartTime;
                const now = performance.now();
                if (now - lastEnergyTickTime >= 15000) {
                    lastEnergyTickTime = now;
                    grantEnergy(1);
                    showEnergyToast('+1 ⚡');
                }
            } else if (isRunActive && deathFrozen) {
                try {
                    const pl = window.game && window.game.hero && window.game.hero.player;
                    if (pl && !pl.dead) { runStartTime += performance.now() - frozenAt; deathFrozen = false; }
                } catch (e) {}
            }
            if (isRunActive && !deathFrozen) {
                if (timerVal) {
                    const prevTotal = (MP.inMatch && MPX.totals) ? (MPX.totals[myProfile.id] || 0) : 0;
                    timerVal.textContent = formatTime(prevTotal + runElapsedTime);
                }
            }
            if (MP.inMatch && !isGamePaused) {
                sendMultiplayerRunnerSync();
            }
        }, 35);
    }

    function stopRunTimer() {
        if (!isRunActive) return;
        isRunActive = false;
        document.body.classList.remove('sw-in-run');
        if (!MP.inMatch) {
            clearInterval(runTimerInterval);
        }
        if (!deathFrozen) runElapsedTime = performance.now() - runStartTime;

        const timeStr = formatTime(runElapsedTime);
        const timerVal = document.getElementById('subway-top-timer-val');
        if (timerVal) timerVal.textContent = timeStr;

        if (!MP.inMatch) saveRecord({
            date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString().slice(0, 5),
            mode: window.NO_COIN_MODE ? 'No Coin' : 'Normal',
            timeMs: runElapsedTime,
            timeStr: timeStr,
            nick: myProfile.nick
        });

        if (MP.inMatch) {
            handleLocalMultiplayerDeath(runElapsedTime);
        }
    }

    function hideRunTimer() {
        document.body.classList.remove('sw-in-run');
        isRunActive = false;
        clearInterval(runTimerInterval);
        const timerWrap = document.getElementById('subway-top-timer-wrap');
        if (timerWrap) timerWrap.style.display = 'none';
    }

    function saveRecord(record) {
        try {
            const history = JSON.parse(localStorage.getItem('subway_surfers_records') || '[]');
            history.unshift(record);
            if (history.length > 50) history.pop();
            localStorage.setItem('subway_surfers_records', JSON.stringify(history));

            // Sync with global leaderboard if valid
            record.avatar = myProfile.avatar;
            record.id = myProfile.id;
            updateGlobalRecord(record);
            broadcastGlobalRecord(record);
        } catch(e) {}
    }

    function getGlobalLeaderboard() {
        try {
            return JSON.parse(localStorage.getItem('subway_global_leaderboard_v1') || '[]');
        } catch(e) {
            return [];
        }
    }

    function updateGlobalRecord(record) {
        if (!record || !record.timeMs || record.timeMs < 1000 || record.timeMs > 86400000) return;
        try {
            let list = getGlobalLeaderboard();
            const idx = list.findIndex(r => r.id === (record.id || (record.nick + '_' + record.mode)) && r.mode === record.mode);
            if (idx !== -1) {
                if (record.timeMs > list[idx].timeMs) {
                    list[idx] = { ...list[idx], ...record };
                }
            } else {
                list.push(record);
            }
            list.sort((a, b) => b.timeMs - a.timeMs);
            if (list.length > 100) list = list.slice(0, 100);
            localStorage.setItem('subway_global_leaderboard_v1', JSON.stringify(list));
        } catch(e) {}
    }

    function broadcastGlobalRecord(specificRecord) {
        try {
            let rec = specificRecord;
            if (!rec) {
                const list = getGlobalLeaderboard().filter(r => r.id === myProfile.id || r.nick === myProfile.nick);
                if (list.length) rec = list[0];
            }
            if (rec && rec.timeMs) {
                sendGlobalMessage('subwaysurf/lobby/records', {
                    type: 'record_share',
                    sender: myProfile,
                    record: rec
                });
            }
        } catch(e) {}
    }

    function handleGlobalRecordReceived(msg) {
        if (!msg || !msg.record) return;
        updateGlobalRecord(msg.record);
        const modal = document.getElementById('modal-unified-menu');
        const activeTab = modal && modal.querySelector('.tab-btn.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'records') {
            const curFilter = (window.__currentRecordFilter || 'global');
            renderRecordsTable(curFilter);
        }
    }

    // Game lifecycle hooks from patched dependencies.bundle.js
    window.__onGameRun = function() {
        startRunTimer();
    };
    window.__onHeroDeath = function() {
        try {
            if (isRunActive && !deathFrozen) {
                deathFrozen = true;
                frozenAt = performance.now();
                runElapsedTime = frozenAt - runStartTime;
            }
            if (MP.inMatch && MPX.roundActive) {
                if (MPX.isPracticing) {
                    setTimeout(() => {
                        if (MPX.isPracticing && MPX.roundActive) {
                            try {
                                ['saveme', 'gameover'].forEach(k => { const s = window.app && window.app[k]; if (s && s.close) s.close(); });
                                if (window.app.game && typeof window.app.game.revive === 'function') {
                                    window.app.game.revive(0, false);
                                } else {
                                    window.app.nav.toGame();
                                }
                                restoreHeroMesh();
                                setTimeout(restoreHeroMesh, 300);
                            } catch (e) {}
                        }
                    }, 500);
                } else {
                    handleLocalMultiplayerDeath(runElapsedTime);
                }
            }
        } catch (e) {}
    };
    // ==========================================
    // NO COIN DYNAMIC OBSTACLE ENGINE
    // ==========================================
    let customObstacles = [];
    let nextObstacleZ = -300;

    function cleanupCustomObstacles() {
        for (let i = 0; i < customObstacles.length; i++) {
            const obs = customObstacles[i];
            if (obs && obs.mesh && obs.mesh.parent) {
                try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
            }
        }
        customObstacles = [];
        nextObstacleZ = (window.game && window.game.hero && window.game.hero.body ? window.game.hero.body.z : 0) - 350;
    }

    // Prevents placing obstacle coins/dumpsters inside trains, barriers or native coins
    function isPositionBlocked(x, y, z, margin = 12) {
        const isAir = (y >= 6.5);
        if (window.__activeCoins && !isAir) {
            for (const c of window.__activeCoins) {
                if (c && c.active && c.body) {
                    if (Math.abs(c.body.z - z) < 22 && Math.abs(c.body.x - x) < 8) {
                        return true;
                    }
                }
            }
        }
        const phys = window.game && window.game.physics;
        if (phys && Array.isArray(phys.entities)) {
            for (let i = 0; i < phys.entities.length; i++) {
                const ent = phys.entities[i];
                const b = ent && ent.body;
                if (b && !b.deco && !b.player) {
                    const halfDepth = (b.depth || 14) / 2 + 15;
                    const halfWidth = (b.width || 14) / 2 + 3;
                    if (Math.abs(b.x - x) < halfWidth && Math.abs(b.z - z) < halfDepth) {
                        return true;
                    }
                }
            }
        }
        for (let i = 0; i < customObstacles.length; i++) {
            const obs = customObstacles[i];
            if (obs && !obs.destroyed) {
                if (Math.abs(obs.z - z) < 24 && Math.abs(obs.x - x) < 8) {
                    if (isAir && (obs.y || 0) < 6.0) continue;
                    return true;
                }
            }
        }
        return false;
    }

    let activeOceanZones = [];

    function createObstacle3D(type, x, y, z, options = {}) {
        if (!window.__lib || !window.__lib.getEntity) return null;
        const margin = (type === 'dumpster' || type === 'bush' || type === 'blocker_jump' || type === 'bounceTrain' || type === 'subwagon' || type === 'wall') ? 28 : 15;
        if (isPositionBlocked(x, y, z, margin)) return null;

        try {
            let mesh = null;
            let bounds = { depth: 6, width: 14, height: 8 };

            if (type === 'dumpster') {
                mesh = window.__lib.getEntity('dumpster');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(1.0, 1.0, 1.0);
                    bounds = { depth: 10, width: 16, height: 12 };
                }
            } else if (type === 'bush') {
                mesh = window.__lib.getEntity('bush_1');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(1.0, 1.0, 1.0);
                    bounds = { depth: 8, width: 15, height: 10 };
                }
            } else if (type === 'blocker_jump') {
                mesh = window.__lib.getEntity('blocker_jump');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(1.0, 1.0, 1.0);
                    bounds = { depth: 6, width: 16, height: 8, jumpable: true };
                }
            } else if (type === 'bounceTrain') {
                mesh = window.__lib.getEntity('train_standardwagon') || window.__lib.getEntity('train_cargo');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(0.85, 0.45, 0.32);
                    setEntityHexColor(mesh, 0x9e36ff);
                    bounds = { depth: 22, width: 14, height: 10, isBounce: true };
                }
            } else if (type === 'subwagon') {
                mesh = window.__lib.getEntity('train_subwagon') || window.__lib.getEntity('train_ramp');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(1.0, 0.8, 1.0);
                    bounds = { depth: 32, width: 14, height: 8, isPlatform: true };
                }
            } else if (type === 'plank') {
                mesh = window.__lib.getEntity('blocker_jump') || window.__lib.getEntity('dumpster');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(1.4, 0.42, 1.5);
                    setEntityHexColor(mesh, 0x8a5a36);
                    y = 0.5;
                    bounds = { depth: 12, width: 15, height: 6, isPlank: true };
                }
            } else if (type === 'wall') {
                // Natural proportionate container (one per lane, no texture stretching!)
                mesh = window.__lib.getEntity('train_cargo');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(0.95, 0.45, 0.35);
                    setEntityHexColor(mesh, 0xd84925);
                    y = 7.2;
                    bounds = { depth: 14, width: 14, height: 10, isWall: true, minClearY: 6.0 };
                }
            } else if (type === 'energy') {
                mesh = window.__lib.getEntity('currency_coin');
                if (mesh) {
                    if (mesh.scale) mesh.scale.set(1.25, 1.65, 0.7);
                    setEntityHexColor(mesh, 0x00e5ff);
                    y = 5.0;
                    bounds = { depth: 6, width: 6, height: 6, isEnergy: true };
                }
            } else if (type === 'drone') {
                mesh = window.__lib.getEntity('sprayCan') || window.__lib.getEntity('dumpster');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = 0;
                    if (mesh.scale) mesh.scale.set(1.5, 0.6, 1.5);
                    setEntityHexColor(mesh, 0x00e5ff);
                    y = 5.0;
                    bounds = { depth: 10, width: 12, height: 8, isDrone: true };
                }
            } else if (type === 'ocean_container') {
                mesh = window.__lib.getEntity('train_cargo');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(0.9, 0.38, 0.55);
                    setEntityHexColor(mesh, 0xd84925);
                    y = 1.0;
                    bounds = { depth: 26, width: 14, height: 6, isWaterPlatform: true };
                }
            } else {
                mesh = window.__lib.getEntity('currency_coin');
                if (mesh) {
                    if (mesh.scale) mesh.scale.set(1.15, 1.15, 1.15);
                    const isNoCoin = !!window.NO_COIN_MODE;
                    setEntityHexColor(mesh, isNoCoin ? 0xff1e1e : 0xffffff);
                    bounds = { depth: 5, width: 4, height: 6, isCoin: true };
                }
            }

            if (!mesh) return null;
            mesh.x = x;
            mesh.y = y;
            mesh.z = z;

            const hero = window.game && window.game.hero;
            if (hero && hero.parent) {
                hero.parent.addChild(mesh);
                return {
                    type,
                    x, y, z,
                    mesh,
                    bounds,
                    destroyed: false,
                    isOscillating: !!options.isOscillating,
                    isFloating: !!options.isFloating,
                    baseX: x,
                    baseY: y,
                    speed: options.speed || 1.8,
                    phase: options.phase || 0
                };
            }
        } catch(e) {}
        return null;
    }

    function spawnCityObstaclePattern(centerZ) {
        const lanes = [-20, 0, 20];
        const freeGroundLanes = lanes.filter(lx => !isPositionBlocked(lx, 0, centerZ, 12));
        if (freeGroundLanes.length === 0) return;

        const isNoCoin = !!window.NO_COIN_MODE;

        // If in No Coin mode, 45% spawn coin traps
        if (isNoCoin && Math.random() < 0.45) {
            const coinPattern = Math.floor(Math.random() * 5);
            if (coinPattern === 0) {
                const c = createObstacle3D('coin', 0, 6, centerZ, { isOscillating: true, speed: 2.2, phase: Math.random() * Math.PI });
                if (c) customObstacles.push(c);
            } else if (coinPattern === 1) {
                const openLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
                freeGroundLanes.forEach(lx => {
                    if (lx !== openLane) {
                        const c1 = createObstacle3D('coin', lx, 6, centerZ);
                        const c2 = createObstacle3D('coin', lx, 14, centerZ);
                        if (c1) customObstacles.push(c1);
                        if (c2) customObstacles.push(c2);
                    }
                });
            } else if (coinPattern === 2) {
                freeGroundLanes.forEach(lx => {
                    const c = createObstacle3D('coin', lx, 4.5, centerZ);
                    if (c) customObstacles.push(c);
                });
            } else if (coinPattern === 3) {
                [-20, 0, 20].forEach((lx, idx) => {
                    const c = createObstacle3D('coin', lx, 6, centerZ - (idx * 50));
                    if (c) customObstacles.push(c);
                });
            } else {
                const tLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
                [5, 12, 19].forEach(yPos => {
                    const c = createObstacle3D('coin', tLane, yPos, centerZ);
                    if (c) customObstacles.push(c);
                });
            }
            return;
        }

        // SUBWAY SURFERS CITY SUITE
        const cityPattern = Math.floor(Math.random() * 8);

        if (cityPattern === 0) {
            // 1. MURO 3 TRILHOS (CONTAINERS SUSPENSOS): 3 containers individuais nos 3 trilhos, SÓ PASSA ROLANDO!
            [-20, 0, 20].forEach(lx => {
                const w = createObstacle3D('wall', lx, 7.2, centerZ);
                if (w) customObstacles.push(w);
            });
        } else if (cityPattern === 1) {
            // 2. TREM BOUNCE (PULA-PULA COM AURA ROXA): Pular em cima arremessa alto com moedas/tokens no céu!
            const bLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const bt = createObstacle3D('bounceTrain', bLane, 0, centerZ);
            if (bt) customObstacles.push(bt);
            for (let k = 1; k <= 3; k++) {
                const c = createObstacle3D(Math.random() > 0.5 ? 'energy' : 'coin', bLane, 16, centerZ - (k * 24));
                if (c) customObstacles.push(c);
            }
        } else if (cityPattern === 2) {
            // 3. TREM PELA METADE / VAGÃO ABERTO: Vagão baixo transitável ao lado de trem normal
            const sLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const sw = createObstacle3D('subwagon', sLane, 0, centerZ);
            if (sw) customObstacles.push(sw);
            const e = createObstacle3D('energy', sLane, 5.0, centerZ - 10);
            if (e) customObstacles.push(e);
        } else if (cityPattern === 3) {
            // 4. TÁBUAS DE MADEIRA QUEBRÁVEIS: Quebra ao pisar/rolar e dropa 3 moedas
            freeGroundLanes.forEach(lx => {
                const p = createObstacle3D('plank', lx, 0.5, centerZ);
                if (p) customObstacles.push(p);
            });
        } else if (cityPattern === 4) {
            // 5. TRILHA DE CÁPSULAS DE ENERGIA AZUIS (⚡)
            const eLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            for (let k = 0; k < 3; k++) {
                const e = createObstacle3D('energy', eLane, 5.0, centerZ - (k * 22));
                if (e) customObstacles.push(e);
            }
        } else if (cityPattern === 5) {
            // 6. PARKOUR DE CONTAINERS FLUTUANTES (Água)
            const seqLanes = [-20, 0, 20];
            seqLanes.forEach((lx, idx) => {
                const oc = createObstacle3D('ocean_container', lx, 1.2, centerZ - (idx * 45), {
                    isFloating: true,
                    speed: 1.5,
                    phase: idx * 1.5
                });
                if (oc) customObstacles.push(oc);
                const coin = createObstacle3D('energy', lx, 6.0, centerZ - (idx * 45));
                if (coin) customObstacles.push(coin);
            });
        } else if (cityPattern === 6) {
            // 7. DRONE VOADOR: Lança o jogador para o alto com trilha aérea de moedas/tokens!
            const dLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const dr = createObstacle3D('drone', dLane, 5.0, centerZ);
            if (dr) customObstacles.push(dr);
            for (let k = 1; k <= 4; k++) {
                const skyCoin = createObstacle3D(k % 2 === 0 ? 'energy' : 'coin', dLane, 16.0, centerZ - (k * 28));
                if (skyCoin) customObstacles.push(skyCoin);
            }
        } else {
            // 8. OBSTÁCULOS NATIVOS
            const lane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const obs = createObstacle3D(Math.random() > 0.5 ? 'bush' : 'dumpster', lane, 0, centerZ);
            if (obs) customObstacles.push(obs);
        }
    }

    function updateObstacleEngine() {
        if (!window.game || !window.game.hero || !window.game.hero.body) {
            if (customObstacles.length) cleanupCustomObstacles();
            return;
        }

        const hero = window.game.hero;
        const heroBody = hero.body;
        const heroZ = heroBody.z;
        const heroX = heroBody.x;
        const heroY = heroBody.y !== undefined ? heroBody.y : (heroBody.bottom || 0);

        if (window.isGamePaused) return;

        // Check spawn ahead of runner
        if (heroZ < nextObstacleZ) {
            spawnCityObstaclePattern(heroZ - 320);
            nextObstacleZ = heroZ - (130 + Math.random() * 70);
        }

        const now = Date.now();
        const isDashing = now < dashInvulnUntil;
        const isJumping = heroY >= 6.0;
        const isRolling = !!(
            (hero && hero.roll && (hero.roll.isRolling || hero.roll._isOn)) ||
            (heroBody && heroBody.height <= 6.5) ||
            (hero && hero.character && hero.character.roll && hero.character.roll.active) ||
            (hero && hero.anim && hero.anim.currentAnimationClipName === 'roll')
        );
        const boardActive = !!(hero && hero.hoverboard && hero.hoverboard.isOn && hero.hoverboard.isOn());

        for (let i = customObstacles.length - 1; i >= 0; i--) {
            const obs = customObstacles[i];
            if (!obs || obs.destroyed) {
                customObstacles.splice(i, 1);
                continue;
            }

            if (obs.z > heroZ + 50) {
                if (obs.mesh && obs.mesh.parent) {
                    try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                }
                customObstacles.splice(i, 1);
                continue;
            }

            const dz = Math.abs(obs.z - heroZ);
            if (dz > 180) continue;

            if (obs.isOscillating && obs.mesh) {
                obs.x = Math.sin(now * 0.003 * obs.speed + obs.phase) * 20;
                obs.mesh.x = obs.x;
            }

            if (obs.isFloating && obs.mesh) {
                obs.y = (obs.baseY || 1.2) + Math.sin(now * 0.004 * obs.speed + obs.phase) * 1.8;
                obs.mesh.y = obs.y;
            }

            if ((obs.type === 'coin' || obs.type === 'energy') && obs.mesh && obs.mesh.rotation) {
                obs.mesh.rotation.y += 0.09;
            }

            const dx = Math.abs(obs.x - heroX);
            const dy = Math.abs(obs.y - heroY);

            // 1. Blue Energy Capsule (⚡)
            if (obs.type === 'energy') {
                if (dz < 8 && dx < 6 && dy < 8) {
                    obs.destroyed = true;
                    if (obs.mesh && obs.mesh.parent) {
                        try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                    }
                    customObstacles.splice(i, 1);
                    grantEnergy(1);
                    showEnergyToast('+1 ⚡');
                    try { if (window.game && window.game.sfx && window.game.sfx.play) window.game.sfx.play('pickup-coin'); } catch(e) {}
                    continue;
                }
            }

            // 2. Regular Coin
            if (obs.type === 'coin') {
                if (dz < 7 && dx < 5 && dy < 7) {
                    obs.destroyed = true;
                    if (obs.mesh && obs.mesh.parent) {
                        try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                    }
                    customObstacles.splice(i, 1);
                    if (window.NO_COIN_MODE) {
                        triggerNoCoinDeath(null);
                        return;
                    } else {
                        try {
                            const u = (window.app && window.app.user) || (window.game && window.game.user);
                            if (u) u.coins = (u.coins || 0) + 1;
                            if (window.game && window.game.sfx && window.game.sfx.play) window.game.sfx.play('pickup-coin');
                        } catch(e) {}
                        continue;
                    }
                }
            }

            // 3. Drone Voador (Air Launch)
            if (obs.type === 'drone') {
                if (dz < 10 && dx < 7 && dy < 9) {
                    obs.destroyed = true;
                    if (obs.mesh && obs.mesh.parent) {
                        try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                    }
                    customObstacles.splice(i, 1);
                    try {
                        if (hero.jump && hero.jump.perform) hero.jump.perform(34, true);
                        else if (heroBody) heroBody.velocity.y = 32;
                        if (window.game && window.game.sfx && window.game.sfx.play) window.game.sfx.play('pickup-jetpack');
                    } catch(e) {}
                    showEnergyToast('🛸 DRONE AÉREO');
                    continue;
                }
            }

            // 4. Trem Bounce (Pula-Pula)
            if (obs.type === 'bounceTrain') {
                if (dz < 16 && dx < 8) {
                    if (heroY >= 2.0 && !obs.bounced) {
                        obs.bounced = true;
                        try {
                            if (hero.jump && hero.jump.perform) hero.jump.perform(38, true);
                            else if (heroBody) heroBody.velocity.y = 35;
                            if (window.game && window.game.sfx && window.game.sfx.play) window.game.sfx.play('pickup-super-sneakers');
                        } catch(e) {}
                        showEnergyToast('⬆️ BOUNCE');
                        continue;
                    }
                }
                if (obs.bounced || heroY >= 2.0) {
                    continue;
                }
            }

            // 5. Tábuas de Madeira Quebráveis (Plank)
            if (obs.type === 'plank') {
                if (dz < 9 && dx < 8) {
                    if (heroY > 1.8 || isRolling || boardActive || isDashing) {
                        obs.destroyed = true;
                        if (obs.mesh && obs.mesh.parent) {
                            try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                        }
                        customObstacles.splice(i, 1);
                        showEnergyToast('📦 DROP');
                        for (let k = 0; k < 3; k++) {
                            const dropCoin = createObstacle3D('coin', obs.x + (k - 1) * 3, 2.5, obs.z - 8);
                            if (dropCoin) customObstacles.push(dropCoin);
                        }
                        try { if (window.game && window.game.sfx && window.game.sfx.play) window.game.sfx.play('wood-break'); } catch(e) {}
                        continue;
                    } else {
                        // Tripping upright
                        if (hero && hero.player && typeof hero.player.stumble === 'function') {
                            hero.player.stumble('bush');
                        }
                        obs.destroyed = true;
                        if (obs.mesh && obs.mesh.parent) {
                            try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                        }
                        customObstacles.splice(i, 1);
                        continue;
                    }
                }
            }

            // 6. Muro 3 Trilhos (Wall): SÓ PASSA ROLANDO!
            if (obs.type === 'wall') {
                const hitDepth = 8;
                const hitWidth = 8;
                if (dz < hitDepth && dx < hitWidth) {
                    if (isRolling) {
                        continue;
                    }
                    if (boardActive) {
                        try { hero.hoverboard.explode ? hero.hoverboard.explode() : hero.hoverboard.turnOff(); } catch(e) {}
                        obs.destroyed = true;
                        if (obs.mesh && obs.mesh.parent) {
                            try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                        }
                        customObstacles.splice(i, 1);
                        showEnergyToast('💥 PROTEGEU');
                        continue;
                    }
                    if (isDashing) {
                        continue;
                    }
                    obs.destroyed = true;
                    if (window.NO_COIN_MODE) {
                        triggerNoCoinDeath(null);
                    } else if (hero.player && hero.player.die) {
                        hero.player.die('train');
                    }
                    return;
                }
                continue;
            }

            // 7. Standard Obstacle Hits (Dumpster, Bush, Blocker Jump)
            const hitDepth = (obs.bounds ? obs.bounds.depth / 2 : 5) + 3.0;
            const hitWidth = (obs.bounds ? obs.bounds.width / 2 : 4) + 1.5;
            const hitHeight = (obs.bounds ? obs.bounds.height : 6) + 2.0;

            if (dz < hitDepth && dx < hitWidth && dy < hitHeight) {
                if (isDashing) {
                    obs.destroyed = true;
                    if (obs.mesh && obs.mesh.parent) {
                        try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                    }
                    customObstacles.splice(i, 1);
                    triggerCoinShatter({ body: { x: obs.x, y: obs.y, z: obs.z } });
                    continue;
                }

                if (obs.type === 'blocker_jump' && isJumping) continue;
                if (obs.type === 'bush' && isJumping) continue;
                if (obs.type === 'subwagon' && heroY >= 2.0) continue;
                if (obs.type === 'ocean_container' && heroY >= 0.8) continue;
                if (obs.type === 'bounceTrain' && (obs.bounced || heroY >= 2.0)) continue;

                obs.destroyed = true;
                if (boardActive) {
                    try { hero.hoverboard.explode ? hero.hoverboard.explode() : hero.hoverboard.turnOff(); } catch(e) {}
                    if (obs.mesh && obs.mesh.parent) {
                        try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                    }
                    customObstacles.splice(i, 1);
                    showEnergyToast('💥 PROTEGEU');
                    continue;
                }

                if (window.NO_COIN_MODE) {
                    triggerNoCoinDeath(null);
                    return;
                } else {
                    if (hero && hero.player) {
                        if (obs.type === 'bush' && typeof hero.player.stumble === 'function') {
                            hero.player.stumble('bush');
                        } else if (typeof hero.player.die === 'function') {
                            hero.player.die('train');
                        }
                    }
                    return;
                }
            }
        }
    }

    setInterval(updateObstacleEngine, 30);

    window.__onGameOver = function() {
        stopRunTimer();
        cleanupCustomObstacles();
    };
    window.__onGameReset = function() {
        hideRunTimer();
        cleanupCustomObstacles();
    };

    // ==========================================
    // ANTI-CHEAT & INTEGRITY SHIELD
    // ==========================================
    (function installAntiCheatShield() {
        try {
            // 1. Sanitize text and URL payloads against XSS injection
            window.__sanitizeInput = function(str, maxLen = 40) {
                if (typeof str !== 'string') return '';
                return str.replace(/[<>"'&]/g, '').slice(0, maxLen).trim();
            };

            // 2. Prevent debugger breakpoints and console inspection tampering
            setInterval(() => {
                const start = performance.now();
                (function() { return false; }['constructor']('debugger')());
                if (performance.now() - start > 100) {
                    // Debugger hook detected
                    window.__dashSpeedMult = 1.0;
                }
            }, 3000);

            // 3. Freeze core game state globals to prevent runtime hijacking
            Object.seal(window.MPX || {});
        } catch(e) {}
    })();

    // ==========================================
    // 7. REAL-TIME MULTIPLAYER (MQTT WEBSOCKETS + P2P)
    // ==========================================
    function initMultiplayerEngine() {
        if (MP.mqtt) return;

        // 1. BroadcastChannel fallback for multi-tab local testing
        try {
            MP.broadcast = new BroadcastChannel('subway_surfers_mp');
            MP.broadcast.onmessage = (e) => handleNetworkMessage(e.data);
        } catch(e) {}

        // 2. Global Real-Time MQTT over WebSockets
        try {
            if (window.mqtt && window.mqtt.connect) {
                const clientId = 'sub_' + myProfile.id + '_' + Math.random().toString(36).substr(2, 4);
                MP.mqtt = window.mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
                    clientId: clientId,
                    clean: true,
                    keepalive: 30
                });

                MP.mqtt.on('connect', () => {
                    console.log('[Multiplayer] MQTT Global Conectado!');
                    // Subscribe to public lobby & private inbox
                    MP.mqtt.subscribe('subwaysurf/lobby/presence');
                    MP.mqtt.subscribe('subwaysurf/lobby/records');
                    MP.mqtt.subscribe('subwaysurf/player/' + myProfile.id);

                    // If in a room, subscribe to room
                    if (MP.currentRoomTopic) {
                        MP.mqtt.subscribe(MP.currentRoomTopic);
                    }
                    broadcastPresence();
                    broadcastGlobalRecord();
                });

                MP.mqtt.on('message', (topic, payload) => {
                    try {
                        const msg = JSON.parse(payload.toString());
                        handleNetworkMessage(msg);
                    } catch(e) {}
                });

                MP.mqtt.on('error', (err) => {
                    console.warn('[Multiplayer] MQTT Erro:', err);
                });
            }
        } catch(e) {
            console.warn('[Multiplayer] Falha ao inicializar MQTT:', e);
        }

        // Heartbeat presence every 3s
        setInterval(broadcastPresence, 3000);
        setInterval(cleanupStalePlayers, 2000);
    }

    function broadcastPresence() {
        const msg = {
            type: 'presence',
            sender: myProfile,
            inParty: MP.party.length > 1,
            partySize: MP.party.length,
            inMatch: MP.inMatch
        };
        sendGlobalMessage('subwaysurf/lobby/presence', msg);
    }

    function cleanupStalePlayers() {
        const now = Date.now();
        let changed = false;
        MP.onlinePlayers.forEach((entry, id) => {
            if (now - entry.lastSeen > 8000) {
                MP.onlinePlayers.delete(id);
                changed = true;
            }
        });
        if (changed) renderOnlinePlayersList();
    }

    function sendGlobalMessage(topic, msg) {
        msg.mid = msg.mid || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
        if (MP.broadcast) {
            try { MP.broadcast.postMessage({ topic: topic, ...msg }); } catch(e) {}
        }
        if (MP.mqtt && MP.mqtt.connected) {
            try { MP.mqtt.publish(topic, JSON.stringify(msg)); } catch(e) {}
        }
    }

    function sendRoomMessage(msg) {
        const topic = MP.currentRoomTopic || ('subwaysurf/room/' + MP.roomId);
        sendGlobalMessage(topic, msg);
    }

    function handleNetworkMessage(msg) {
        if (!msg || !msg.type) return;

        if (msg.mid) {
            if (MPX.seen.has(msg.mid)) return;
            MPX.seen.add(msg.mid);
            if (MPX.seen.size > 600) MPX.seen.clear();
        }

        // Ignore messages from self
        if (msg.sender && msg.sender.id === myProfile.id) return;

        switch(msg.type) {
            case 'presence':
                handlePresenceMessage(msg);
                break;
            case 'record_share':
                handleGlobalRecordReceived(msg);
                break;
            case 'invite':
                handleInviteReceived(msg);
                break;
            case 'invite_response':
                handleInviteResponse(msg);
                break;
            case 'party_sync':
                handlePartySync(msg);
                break;
            case 'party_ready':
                handlePartyReady(msg);
                break;
            case 'party_leave':
                handlePartyLeave(msg);
                break;
            case 'hb':
                handleHeartbeat(msg);
                break;
            case 'round_start':
                if (!MP.isPartyLeader) handleRoundStart(msg);
                break;
            case 'round_end':
                if (!MP.isPartyLeader) handleRoundEnd(msg);
                break;
            case 'tick':
                handleTick(msg);
                break;
            case 'player_death':
                handlePlayerDeath(msg);
                break;
            case 'coop_pos':
                handleCoopPos(msg);
                break;
            case 'mp_mode_change':
                handleMPModeChange(msg);
                break;
            case 'party_leave_ack':
                if (msg.full) { showHUDNotification('Grupo cheio.'); leaveToOwnRoom(); }
                break;
        }
    }

    function handlePresenceMessage(msg) {
        const sender = msg.sender;
        if (!sender || sender.id === myProfile.id) return;
        MP.onlinePlayers.set(sender.id, {
            profile: sender,
            lastSeen: Date.now(),
            inParty: msg.inParty,
            inMatch: msg.inMatch
        });
        renderOnlinePlayersList();
    }

    function handleInviteReceived(msg) {
        // Show invitation popup
        const from = msg.sender;
        const roomId = msg.roomId;

        const pop = document.createElement('div');
        pop.className = 'subway-invite-popup';
        pop.innerHTML = `
            <div class="invite-pop-box">
                <img class="invite-pop-avatar" src="${from.avatar}" />
                <div class="invite-pop-text">
                    <strong>${from.nick}</strong> convidou você para jogar No Coin!
                </div>
                <div class="invite-pop-actions">
                    <button class="btn-invite-accept" id="btn-acc-inv">Aceitar</button>
                    <button class="btn-invite-reject" id="btn-rej-inv">Recusar</button>
                </div>
            </div>
        `;
        document.body.appendChild(pop);

        pop.querySelector('#btn-acc-inv').onclick = () => {
            pop.remove();
            acceptInvite(from, roomId);
        };
        pop.querySelector('#btn-rej-inv').onclick = () => {
            pop.remove();
            sendGlobalMessage('subwaysurf/player/' + from.id, {
                type: 'invite_response',
                sender: myProfile,
                accepted: false
            });
        };
        setTimeout(() => { if (pop.parentNode) pop.remove(); }, 12000);
    }

        // ==========================================
    // 7. MULTIPLAYER ELIMINATION TOURNAMENT ENGINE (MPX)
    // ==========================================
    const MPX = {
        round: 0,
        totalRounds: 3,
        activeIds: [],       // Players currently racing in the round
        eliminated: {},      // { [id]: { round: 1, rank: 4, label: '4º Lugar' } }
        roundTimes: {},      // { [round]: { [id]: timeMs } }
        totals: {},          // { [id]: totalTimeMs }
        wins: {},            // { [id]: winCount } for 2p MD3
        live: {},            // { [id]: liveMs }
        dead: {},            // { [id]: deathMs }
        lastTick: {},
        roundActive: false,
        lastSeen: {},
        myRseq: 0,
        endedRound: 0,
        seen: new Set(),
        botTimer: null,
        botPlan: {},
        suppressTimer: null,
        interTimer: null,
        autoTimer: null,
        loneSurvivorTimer: null,
        lastTickSent: 0,
        lastHostMsg: Date.now(),
        goAt: 0,
        partySizeAtStart: 0
    };
    window.__MP = MP;
    window.__MPX = MPX;
    window.__myProfile = myProfile;

    const isBot = id => String(id).startsWith('bot_');

    // ==========================================
    // 7.1 CO-OP MULTIPLAYER SYNCHRONIZED ENGINE
    // ==========================================
    const coopTeammates = {};
    let coopRenderRaf = null;
    let deterministicRandomSeed = null;

    function setDeterministicRandom(seed) {
        deterministicRandomSeed = (seed >>> 0) || 123456789;
        if (!window.__origMathRandom) window.__origMathRandom = Math.random;
        Math.random = function() {
            deterministicRandomSeed = (deterministicRandomSeed + 0x6D2B79F5) | 0;
            let t = Math.imul(deterministicRandomSeed ^ (deterministicRandomSeed >>> 15), 1 | deterministicRandomSeed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function restoreNormalRandom() {
        if (window.__origMathRandom) {
            Math.random = window.__origMathRandom;
        }
    }

    function getMaxPartySize() {
        return MP.matchType === '1v1' ? 2 : 5;
    }

    window.__setMPMatchType = function(type) {
        if (!MP.isPartyLeader) {
            showHUDNotification('Apenas o líder da sala pode alterar o modo de jogo.');
            return;
        }
        MP.matchType = type;
        if (type === '1v1' && MP.party.length > 2) {
            MP.party = MP.party.slice(0, 2);
            syncPartyToAll();
        }
        sendRoomMessage({ type: 'mp_mode_change', mode: type });
        updateLobbyHeaderTitles();
        renderPartySlots();
        showHUDNotification(type === '1v1' ? '⚔️ Modo Duelo 1v1 ativado (2 jogadores, 1 rodada)!' : '🏆 Modo Torneio ativado (até 5 jogadores, 3 rodadas)!');
    };

    function handleMPModeChange(msg) {
        if (!msg || !msg.mode) return;
        MP.matchType = msg.mode;
        updateLobbyHeaderTitles();
        renderPartySlots();
        showHUDNotification(msg.mode === '1v1' ? '⚔️ Modo Duelo 1v1 ativado pelo líder!' : '🏆 Modo Torneio ativado pelo líder!');
    }

    function updateLobbyHeaderTitles() {
        const titleEl = document.getElementById('lobby-party-title');
        const descEl = document.getElementById('lobby-party-desc');
        const is1v1 = MP.matchType === '1v1';
        if (titleEl) {
            titleEl.textContent = is1v1 ? `DUELO 1V1 (${MP.party.length}/2)` : `TORNEIO (${MP.party.length}/5)`;
        }
        if (descEl) {
            descEl.textContent = is1v1
                ? 'Duelo Direto 1v1 · 1 Rodada Única · Maior sobrevivência vence'
                : 'Torneio Competitivo · 3 Rodadas · Até 5 Jogadores · 5s entre rodadas';
        }
        const startBtn = document.getElementById('btn-start-match');
        if (startBtn) {
            startBtn.textContent = is1v1 ? 'INICIAR DUELO 1V1' : 'INICIAR TORNEIO';
        }
        const modeButtons = document.querySelectorAll('.btn-mp-mode');
        modeButtons.forEach(btn => {
            const m = btn.getAttribute('data-mode');
            btn.classList.toggle('active', m === MP.matchType);
        });
    }

    function handleCoopPos(msg) {
        if (!MP.inMatch || !msg.sender || msg.sender.id === myProfile.id) return;
        const id = msg.sender.id;
        let tm = coopTeammates[id];
        if (!tm) {
            tm = {
                id: id,
                nick: msg.sender.nick || 'Corredor',
                avatar: msg.sender.avatar || DEFAULT_AVATARS[0].url,
                currentX: msg.x || 0,
                currentY: msg.y || 0,
                currentZ: msg.z || 0,
                targetX: msg.x || 0,
                targetY: msg.y || 0,
                targetZ: msg.z || 0,
                anim: msg.anim || 'run',
                alive: msg.alive !== false,
                lastSeen: Date.now(),
                mesh: null,
                tagEl: null
            };
            coopTeammates[id] = tm;
        } else {
            tm.targetX = msg.x || 0;
            tm.targetY = msg.y || 0;
            tm.targetZ = msg.z || 0;
            tm.anim = msg.anim || 'run';
            tm.alive = msg.alive !== false;
            tm.lastSeen = Date.now();
        }
    }

    function projectWorldToScreen(worldX, worldY, worldZ) {
        const hero = window.game && window.game.hero;
        const heroBody = hero && hero.body;
        const heroX = heroBody ? heroBody.x : 0;
        const heroY = heroBody ? (heroBody.y || 0) : 0;
        const heroZ = heroBody ? heroBody.z : 0;

        const canvas = document.querySelector('#game-canvas') || (window.app && window.app.view) || document.querySelector('canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

        const camX = heroX * 0.4;
        const camY = heroY + 28;
        const camZ = heroZ + 58;

        const relX = worldX - camX;
        const relY = (worldY + 14) - camY;
        const relZ = worldZ - camZ;

        if (relZ >= -6) return null; // Behind camera

        const depth = -relZ;
        const focal = (rect.height * 0.82) / depth;
        const sx = rect.left + (rect.width * 0.5) + (relX * focal);
        const sy = rect.top + (rect.height * 0.5) - (relY * focal);

        return { x: sx, y: sy, depth: depth, scale: Math.max(0.4, Math.min(1.15, 50 / depth)) };
    }

    function spawnTeammateMesh(tm) { return null; /* Disabled: Solo clean runner view */

        try {
            const hero = window.game && window.game.hero;
            if (!hero || !hero.parent) return null;

            let charEntity = null;

            // 1. Primary: Instantiate real 3D Character (Jake)
            if (typeof window.Character_Character === 'function') {
                try {
                    charEntity = new window.Character_Character();
                    if (charEntity) {
                        if (charEntity.idleScene) {
                            charEntity.idleScene._active = false;
                            charEntity.idleScene._worldActive = false;
                            charEntity.idleScene.visible = false;
                        }
                        if (charEntity.sprayCan) {
                            charEntity.sprayCan._active = false;
                            charEntity.sprayCan._worldActive = false;
                            charEntity.sprayCan.visible = false;
                        }
                        if (charEntity.gameScene) {
                            charEntity.gameScene._active = true;
                            charEntity.gameScene._worldActive = true;
                            charEntity.gameScene.visible = true;
                        }
                        if (charEntity.anim) {
                            if (charEntity.gameScene) charEntity.anim.currentScene = charEntity.gameScene;
                            if (charEntity.anim.updateCurrentAnimation) charEntity.anim.updateCurrentAnimation();
                            charEntity.anim.play('run3', { loop: true });
                        }
                        if (charEntity.body) {
                            charEntity.body.ghost = true;
                            charEntity.body.sensor = true;
                            charEntity.body.movable = false;
                        }
                        if (charEntity.player) {
                            charEntity.player.die = () => {};
                        }
                        hero.parent.addChild(charEntity);
                        charEntity.x = tm.currentX;
                        charEntity.y = tm.currentY;
                        charEntity.z = tm.currentZ;
                        charEntity.ry = Math.PI;
                        return charEntity;
                    }
                } catch(e) {
                    console.warn('Character_Character instantiate error:', e);
                }
            }

            // 2. Direct Library Scene fallback: load jake-game directly from library
            if (!charEntity && window.__lib && typeof window.__lib.getScene === 'function') {
                try {
                    const scene = window.__lib.getScene('jake-game', { map: 'jake-tex' });
                    if (scene) {
                        hero.parent.addChild(scene);
                        scene.x = tm.currentX;
                        scene.y = tm.currentY;
                        scene.z = tm.currentZ;
                        scene.ry = Math.PI;
                        return scene;
                    }
                } catch(e) {
                    console.warn('Library scene fallback error:', e);
                }
            }

            // 3. Ultra-safe 3D entity fallback from library
            if (!charEntity && window.__lib && typeof window.__lib.getEntity === 'function') {
                const fallback = window.__lib.getEntity('sprayCan') || window.__lib.getEntity('currency_coin');
                if (fallback) {
                    if (fallback.scale) fallback.scale.set(1.5, 1.5, 1.5);
                    if (typeof setEntityHexColor === 'function') setEntityHexColor(fallback, 0x00f0ff);
                    hero.parent.addChild(fallback);
                    fallback.x = tm.currentX;
                    fallback.y = tm.currentY;
                    fallback.z = tm.currentZ;
                    return fallback;
                }
            }
        } catch(e) {}
        return null;
    }

    function getOrCreateNametagEl(tm) { return null; /* Disabled: No tags over runners */

        let tag = document.getElementById(`coop-tag-${tm.id}`);
        if (!tag) {
            let overlay = document.getElementById('subway-coop-tags-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'subway-coop-tags-overlay';
                overlay.className = 'subway-coop-tags-overlay';
                document.body.appendChild(overlay);
            }
            tag = document.createElement('div');
            tag.id = `coop-tag-${tm.id}`;
            tag.className = 'coop-teammate-nametag';
            tag.innerHTML = `
                <div class="coop-tag-bubble">
                    <img class="coop-tag-av" src="${tm.avatar}" alt="" />
                    <div class="coop-tag-col">
                        <span class="coop-tag-nick">${tm.nick}</span>
                        <span class="coop-tag-dist">Sincronizando...</span>
                    </div>
                </div>
                <div class="coop-tag-arrow"></div>
            `;
            overlay.appendChild(tag);
        }
        return tag;
    }

    function startCoopRenderLoop() {
        cancelAnimationFrame(coopRenderRaf);
        const loop = () => {
            if (!MP.inMatch || !MPX.roundActive) {
                cleanupCoopTeammates();
                return;
            }
            updateCoopTeammates();
            coopRenderRaf = requestAnimationFrame(loop);
        };
        coopRenderRaf = requestAnimationFrame(loop);
    }

    function updateCoopTeammates() {
        const hero = window.game && window.game.hero;
        const heroBody = hero && hero.body;
        const heroZ = heroBody ? heroBody.z : 0;

        Object.keys(coopTeammates).forEach(id => {
            const tm = coopTeammates[id];
            if (!tm) return;

            // Smooth position interpolation
            tm.currentX += (tm.targetX - tm.currentX) * 0.35;
            tm.currentY += (tm.targetY - tm.currentY) * 0.35;
            tm.currentZ += (tm.targetZ - tm.currentZ) * 0.35;

            // Spawn or update 3D mesh
            if (!tm.mesh || !tm.mesh.parent) {
                tm.mesh = spawnTeammateMesh(tm);
            }
            if (tm.mesh) {
                tm.mesh.x = tm.currentX;
                tm.mesh.y = tm.currentY;
                tm.mesh.z = tm.currentZ;
                if (tm.mesh.model) {
                    tm.mesh.model.x = tm.currentX;
                    tm.mesh.model.y = tm.currentY;
                    tm.mesh.model.z = tm.currentZ;
                }

                // Synchronize Jake's animations in real time
                if (tm.mesh.anim) {
                    const targetAnim = tm.alive ? (tm.anim || 'run3') : 'death_bounce';
                    if (tm.mesh.anim.currentAnimationClipName !== targetAnim) {
                        const isLoop = ['run3', 'superRun', 'paintIdle', 'Jetpack_forward'].includes(targetAnim);
                        try {
                            tm.mesh.anim.play(targetAnim, { loop: isLoop, sudden: false });
                        } catch(e) {}
                    }
                    try {
                        if (typeof tm.mesh.anim.update === 'function') {
                            const dtFrames = Math.min((Date.now() - (tm._lastAnimTick || Date.now())) / 16.666, 2.5) || 1.0; tm._lastAnimTick = Date.now(); tm.mesh.anim.update({ frameTime: dtFrames });
                        }
                    } catch(e) {}
                }

                if (!tm.alive) {
                    tm.mesh.rx = Math.PI * 0.5;
                    tm.mesh.y = 1;
                } else {
                    tm.mesh.rx = 0;
                    tm.mesh.ry = Math.PI;
                }
            }

            // Project 2D Nametag Billboard
            const proj = projectWorldToScreen(tm.currentX, tm.currentY, tm.currentZ);
            const tag = getOrCreateNametagEl(tm);
            if (tag) {
                if (proj) {
                    tag.style.display = 'flex';
                    tag.style.transform = `translate(-50%, -100%) translate(${proj.x}px, ${proj.y}px) scale(${proj.scale})`;
                    tag.style.zIndex = String(Math.floor(10000 - proj.depth));

                    const distMeters = Math.round((tm.currentZ - heroZ) * 0.1);
                    const distSpan = tag.querySelector('.coop-tag-dist');
                    if (distSpan) {
                        if (!tm.alive) {
                            distSpan.innerHTML = '<b style="color:#ff4d4f;">💥 CAIU!</b>';
                        } else if (distMeters < -2) {
                            distSpan.innerHTML = `<span style="color:#00ffc2;">▲ ${Math.abs(distMeters)}m à frente</span>`;
                        } else if (distMeters > 2) {
                            distSpan.innerHTML = `<span style="color:#4dabf7;">▼ ${Math.abs(distMeters)}m atrás</span>`;
                        } else {
                            distSpan.innerHTML = '<span style="color:#ffd43b;">★ LADO A LADO</span>';
                        }
                    }
                } else {
                    tag.style.display = 'none';
                }
            }
        });

        updateCoopHUD();
    }

    function cleanupCoopTeammates() {
        cancelAnimationFrame(coopRenderRaf);
        Object.keys(coopTeammates).forEach(id => {
            const tm = coopTeammates[id];
            if (tm && tm.mesh && tm.mesh.parent) {
                try { tm.mesh.parent.removeChild(tm.mesh); } catch(e) {}
            }
        });
        for (const k in coopTeammates) delete coopTeammates[k];
        removeEl('subway-coop-tags-overlay'); document.querySelectorAll('.coop-teammate-nametag, #subway-coop-tags-overlay').forEach(e => e.remove());
        removeEl('subway-coop-hud');
    }

    function showCoopHUD() {
        let hud = document.getElementById('subway-coop-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'subway-coop-hud';
            hud.className = 'subway-coop-hud';
            const is1v1 = MP.matchType === '1v1';
            hud.innerHTML = `
                <div class="coop-hud-pill">
                    <span class="coop-hud-badge">${is1v1 ? '⚔️ DUELO 1V1' : '🏆 TORNEIO ONLINE'}</span>
                    <span class="coop-hud-stat" id="coop-hud-team-score">${is1v1 ? 'RODADA ÚNICA' : `RODADA ${MPX.round}/3`}</span>
                </div>
            `;
            document.body.appendChild(hud);
        }
    }

    function updateCoopHUD() {
        const hudStat = document.getElementById('coop-hud-team-score');
        if (!hudStat) return;
        const hero = window.game && window.game.hero;
        const heroZ = (hero && hero.body) ? Math.abs(hero.body.z) : 0;
        const meters = Math.round(heroZ * 0.1);
        if (MP.matchType === '1v1') {
            hudStat.textContent = `${meters}m · 1V1`;
        } else {
            hudStat.textContent = `${meters}m · R${MPX.round}/3`;
        }
    }

    function leaveToOwnRoom() {
        MP.roomId = 'room_' + myProfile.id;
        MP.currentRoomTopic = 'subwaysurf/room/' + MP.roomId;
        MP.hostId = null;
        MP.isPartyLeader = true;
        MP.isReady = false;
        MP.party = [{ ...myProfile, ready: false, isLeader: true, rseq: 0 }];
        MPX.myRseq = 0;
        if (MP.mqtt && MP.mqtt.connected) MP.mqtt.subscribe(MP.currentRoomTopic);
        renderPartySlots();
        updateRoomCodeUI();
    }

    function acceptInvite(host, roomId) {
        MP.roomId = roomId;
        MP.hostId = host.id;
        MP.isPartyLeader = false;
        MP.isReady = false;
        MPX.myRseq = 0;
        MPX.lastHostMsg = Date.now();
        MP.currentRoomTopic = 'subwaysurf/room/' + roomId;
        MP.party = [{ ...myProfile, ready: false, isLeader: false, rseq: 0 }];

        if (MP.mqtt && MP.mqtt.connected) MP.mqtt.subscribe(MP.currentRoomTopic);

        sendGlobalMessage('subwaysurf/player/' + host.id, {
            type: 'invite_response',
            sender: myProfile,
            accepted: true,
            roomId: roomId
        });

        showHUDNotification('✅ Entrou no grupo de ' + host.nick + '!');
        renderPartySlots();
        updateRoomCodeUI();
    }

    function handleInviteResponse(msg) {
        if (!MP.isPartyLeader) return;
        const player = msg.sender;
        if (msg.accepted) {
            const maxParty = getMaxPartySize();
            if (!MP.inMatch && MP.party.length < maxParty && !MP.party.some(p => p.id === player.id)) {
                MP.party.push({ id: player.id, nick: player.nick, avatar: player.avatar, ready: false, isLeader: false, rseq: 0 });
                MPX.lastSeen[player.id] = Date.now();
                syncPartyToAll();
                showHUDNotification('🎉 ' + player.nick + ' entrou no grupo!');
            } else if (MP.party.length >= maxParty) {
                sendGlobalMessage('subwaysurf/player/' + player.id, { type: 'party_leave_ack', sender: myProfile, full: true });
            }
        } else {
            showHUDNotification('❌ ' + player.nick + ' recusou o convite.');
        }
        renderPartySlots();
    }

    function syncPartyToAll() {
        sendRoomMessage({ type: 'party_sync', sender: myProfile, party: MP.party, inMatch: MP.inMatch });
    }

    function handlePartySync(msg) {
        if (MP.isPartyLeader || !Array.isArray(msg.party)) return;
        MPX.lastHostMsg = Date.now();
        const mine = msg.party.find(p => p.id === myProfile.id);
        if (!mine) { if (!MP.inMatch) { showHUDNotification('Você saiu do grupo.'); leaveToOwnRoom(); } return; }
        if ((mine.rseq || 0) < MPX.myRseq) { mine.ready = MP.isReady; mine.rseq = MPX.myRseq; }
        else MP.isReady = !!mine.ready;
        MP.party = msg.party.map(p => ({ ...p }));
        renderPartySlots();
        if (MP.inMatch) renderTimeline();
    }

    function toggleReady() {
        if (MP.inMatch) return;
        MP.isReady = !MP.isReady;
        MPX.myRseq++;
        const me = MP.party.find(p => p.id === myProfile.id);
        if (me) { me.ready = MP.isReady; me.rseq = MPX.myRseq; }
        if (MP.isPartyLeader) {
            syncPartyToAll();
            maybeAutoStart();
        } else {
            sendRoomMessage({ type: 'party_ready', sender: myProfile, ready: MP.isReady, rseq: MPX.myRseq });
        }
        renderPartySlots();
    }

    function handlePartyReady(msg) {
        if (!MP.isPartyLeader || MP.inMatch) return;
        const player = MP.party.find(p => p.id === msg.sender.id);
        if (player) {
            player.ready = !!msg.ready;
            player.rseq = msg.rseq || 0;
            MPX.lastSeen[player.id] = Date.now();
            syncPartyToAll();
            renderPartySlots();
            maybeAutoStart();
        }
    }

    function handlePartyLeave(msg) {
        if (!MP.isPartyLeader || MP.inMatch) return;
        MP.party = MP.party.filter(p => p.id !== msg.sender.id);
        syncPartyToAll();
        renderPartySlots();
    }

    window.__leaveParty = function() {
        if (MP.inMatch) return;
        if (!MP.isPartyLeader) sendRoomMessage({ type: 'party_leave', sender: myProfile });
        leaveToOwnRoom();
    };

    function handleHeartbeat(msg) {
        MPX.lastSeen[msg.sender.id] = Date.now();
    }

    function lobbyHeartbeat() {
        if (MP.inMatch) return;
        if (MP.isPartyLeader) {
            const now = Date.now();
            const before = MP.party.length;
            MP.party = MP.party.filter(p => p.isLeader || isBot(p.id) || p.id === myProfile.id || (now - (MPX.lastSeen[p.id] || now)) < 9000);
            if (MP.party.length > 1 || before !== MP.party.length) { syncPartyToAll(); renderPartySlots(); }
        } else {
            sendRoomMessage({ type: 'hb', sender: myProfile });
            if (Date.now() - MPX.lastHostMsg > 14000) { showHUDNotification('Conexão com o líder perdida.'); leaveToOwnRoom(); }
        }
    }
    setInterval(lobbyHeartbeat, 2000);

    function checkCanStartMatch() {
        if (MP.party.length < 2) return false;
        if (MP.matchType === '1v1' && MP.party.length !== 2) return false;
        return MP.party.every(p => p.ready === true);
    }

    function maybeAutoStart() {
        if (!MP.isPartyLeader || MP.inMatch) return;
        clearTimeout(MPX.autoTimer);
        if (!checkCanStartMatch()) return;
        MPX.autoTimer = setTimeout(() => { if (MP.isPartyLeader && !MP.inMatch && checkCanStartMatch()) startSeries(); }, 1200);
    }

    function requestStartMatch() {
        if (!MP.isPartyLeader) { alert('Apenas o líder da sala pode iniciar a partida.'); return; }
        if (!checkCanStartMatch()) {
            if (MP.matchType === '1v1' && MP.party.length !== 2) {
                alert('No modo Duelo 1v1 são necessários exatamente 2 jogadores prontos!');
                return;
            }
            alert('Atenção: Todos os corredores devem dar PRONTO antes de iniciar!');
            return;
        }
        startSeries();
    }

    // ==========================================
    // TOURNAMENT PROGRESSION & ELIMINATIONS
    // ==========================================
    function startSeries() {
        clearTimeout(MPX.autoTimer);
        MPX.round = 0;
        MPX.endedRound = 0;
        MPX.totals = {};
        MPX.wins = {};
        MPX.eliminated = {};
        MPX.roundTimes = {};
        MPX.partySizeAtStart = MP.party.length;

        // Everyone in party starts as active competitor
        MPX.activeIds = MP.party.map(p => p.id);
        MP.party.forEach(p => {
            MPX.totals[p.id] = 0;
            MPX.wins[p.id] = 0;
        });

        if (MP.matchType === '1v1') {
            MPX.totalRounds = 1;
        } else {
            MPX.totalRounds = 3;
        }

        hostBeginRound();
    }

    function hostBeginRound() {
        MPX.round += 1;
        clearTimeout(MPX.loneSurvivorTimer);
        MPX.loneSurvivorTimer = null;

        let roundLabel = '';
        if (MP.matchType === '1v1') {
            roundLabel = 'DUELO 1V1 — RODADA DECISIVA';
            MPX.totalRounds = 1;
        } else {
            MPX.totalRounds = 3;
            if (MPX.round === 3) {
                roundLabel = 'GRANDE FINAL DO TORNEIO (RODADA 3/3)';
            } else {
                roundLabel = `RODADA ${MPX.round}/3 DO TORNEIO`;
            }
        }

        const msg = {
            type: 'round_start',
            sender: myProfile,
            party: MP.party,
            round: MPX.round,
            totalRounds: MPX.totalRounds,
            activeIds: MPX.activeIds,
            eliminated: MPX.eliminated,
            roundLabel: roundLabel,
            totals: MPX.totals,
            wins: MPX.wins,
            delay: 3,
            matchType: MP.matchType,
            seed: Math.floor(Math.random() * 10000000)
        };
        sendRoomMessage(msg);
        handleRoundStart(msg);
    }

    function handleRoundStart(msg) {
        if (!MP.isPartyLeader && msg.party) MP.party = msg.party.map(p => ({ ...p }));
        if (msg.matchType) MP.matchType = msg.matchType;
        if (msg.seed) {
            if (window.Chance) window.chance = new window.Chance(msg.seed);
            setDeterministicRandom(msg.seed);
        }
        cleanupCoopTeammates();

        MPX.round = msg.round;
        MPX.totalRounds = msg.totalRounds || 3;
        MPX.activeIds = msg.activeIds || MP.party.map(p => p.id);
        MPX.eliminated = msg.eliminated || {};
        MPX.totals = msg.totals || MPX.totals;
        MPX.wins = msg.wins || MPX.wins;
        MPX.live = {};
        MPX.dead = {};
        MPX.lastTick = {};
        MPX.roundActive = false;
        MPX.endedRound = MPX.round - 1;
        clearTimeout(MPX.loneSurvivorTimer);
        MPX.loneSurvivorTimer = null;

        window.GAME_MODE = 'nocoin';
        window.NO_COIN_MODE = true;
        localStorage.setItem('subway_game_mode', 'nocoin');
        updateModeBadgeUI();

        MP.active = true;
        MP.inMatch = true;
        closeUnifiedModal();
        removeEl('subway-interlude');
        removeEl('subway-wait-hud');
        removeEl('subway-final-banner');
        suppressRevive(false);
        showTimeline();
        renderTimeline();

        const isEliminatedAlready = !!MPX.eliminated[myProfile.id];

        const titleText = msg.roundLabel || `RODADA ${MPX.round} / ${MPX.totalRounds}`;
        runCountdown(msg.delay || 3, titleText, () => {
            MPX.roundActive = true;
            MPX.goAt = Date.now();
            try { if (window.app && window.app.user) window.app.user.tutorial = true; } catch (e) {}

            try { window.app.nav.toGame(); } catch (e) {}
            setTimeout(restoreHeroMesh, 300);

            startCoopRenderLoop();
            showCoopHUD();

            if (MP.isPartyLeader) hostStartBots();
        });
    }

    function removeEl(id) { const e = document.getElementById(id); if (e) e.remove(); }

    function runCountdown(seconds, label, done) {
        window.__runCountdown = runCountdown;
        removeEl('subway-cd-overlay');
        const countSec = Math.min(seconds || 2, 2); // Snappy 2s count for instant race start
        const ov = document.createElement('div');
        ov.className = 'subway-countdown-overlay';
        ov.id = 'subway-cd-overlay';
        ov.innerHTML = `
            <div class="cd-container">
                <div class="countdown-num pop" id="cd-num">${countSec}</div>
                <div class="countdown-sub">${label}</div>
            </div>
        `;
        document.body.appendChild(ov);
        let c = countSec;
        let finished = false;

        const tm = setInterval(() => {
            if (finished) return;
            c--;
            const n = document.getElementById('cd-num');
            if (c > 0) {
                if (n) {
                    n.textContent = c;
                    n.classList.remove('pop');
                    void n.offsetWidth;
                    n.classList.add('pop');
                }
            } else if (c === 0) {
                finished = true;
                clearInterval(tm);
                if (n) {
                    n.textContent = 'VAI!';
                    n.className = 'countdown-num go';
                }
                setTimeout(() => {
                    ov.classList.add('fade-out');
                    setTimeout(() => {
                        ov.remove();
                        done();
                    }, 80);
                }, 220);
            }
        }, 650); // Snappy 650ms interval for zero-delay feel
    }

    window.__runCountdown = runCountdown;

    // Bots simulation for testing
    function hostStartBots() {
        clearInterval(MPX.botTimer);
        const t0 = performance.now();
        MPX.botPlan = {};
        // Assign realistic survival time between 15s and 50s for each active bot
        MP.party.forEach(p => { const id = p.id;
            if (isBot(id)) {
                MPX.botPlan[id] = 16000 + Math.random() * 32000;
            }
        });
        if (!Object.keys(MPX.botPlan).length) return;

        MPX.botTimer = setInterval(() => {
            if (!MPX.roundActive) { clearInterval(MPX.botTimer); return; }
            const t = performance.now() - t0;
            Object.keys(MPX.botPlan).forEach(id => {
                if (MPX.dead[id] !== undefined) return;
                const p = MP.party.find(x => x.id === id);
                if (!p) return;
                const sender = { id: p.id, nick: p.nick, avatar: p.avatar };
                if (t >= MPX.botPlan[id]) {
                    const m = { type: 'player_death', sender, timeMs: MPX.botPlan[id], round: MPX.round };
                    sendRoomMessage(m);
                    handlePlayerDeath(m);
                } else {
                    MPX.live[id] = t;
                    MPX.lastTick[id] = Date.now();
                    sendRoomMessage({ type: 'tick', sender, t, round: MPX.round });

                    if (MP.inMatch) {
                        const hero = window.game && window.game.hero;
                        const heroZ = (hero && hero.body) ? hero.body.z : -(t * 0.05);
                        const idx = MP.party.findIndex(x => x.id === id);
                        const lane = (idx === 1 ? -20 : (idx === 2 ? 20 : 0));
                        const zOffset = (idx * 8) - 16;
                        let botAnim = 'run3';
                        const cycle = Math.floor(t / 1800) % 5;
                        if (cycle === 2) botAnim = 'jump';
                        else if (cycle === 4) botAnim = 'roll';

                        const botMsg = {
                            type: 'coop_pos',
                            sender,
                            x: lane,
                            y: botAnim === 'jump' ? 12 : 0,
                            z: heroZ + zOffset,
                            anim: botAnim,
                            charId: 'jake',
                            alive: true,
                            round: MPX.round
                        };
                        handleCoopPos(botMsg);
                    }
                }
            });
            renderTimeline();
        }, 100);
    }

    // Live tick sender from active runner
    function sendMultiplayerRunnerSync() {
        if (!MP.inMatch || !MPX.roundActive || !isRunActive) return;
        const now = performance.now();
        const minInterval = 50;
        if (now - (MPX.lastTickSent || 0) < minInterval) return;
        MPX.lastTickSent = now;
        if (MPX.dead[myProfile.id] !== undefined) return;
        MPX.live[myProfile.id] = runElapsedTime;

        const hero = window.game && window.game.hero;
        const heroBody = hero && hero.body;
        if (heroBody) {
            let currentAnim = 'run3';
            if (hero.anim && hero.anim.currentAnimationClipName) {
                currentAnim = hero.anim.currentAnimationClipName;
            } else if (heroBody.y > 2) {
                currentAnim = 'jump';
            } else if (hero.roll && typeof hero.roll.isOn === 'function' && hero.roll.isOn()) {
                currentAnim = 'roll';
            }
            sendRoomMessage({
                type: 'coop_pos',
                sender: myProfile,
                x: heroBody.x || 0,
                y: heroBody.y !== undefined ? heroBody.y : 0,
                z: heroBody.z || 0,
                anim: currentAnim,
                charId: (hero.anim && hero.anim.character) || 'jake',
                alive: true,
                round: MPX.round
            });
        }
        sendRoomMessage({ type: 'tick', sender: myProfile, t: runElapsedTime, round: MPX.round });
        renderTimeline();
    }

    function handleTick(msg) {
        if (!MP.inMatch || msg.round !== MPX.round || !msg.sender) return;
        const id = msg.sender.id;
        if (MPX.dead[id] !== undefined) return;
        MPX.live[id] = msg.t;
        MPX.lastTick[id] = Date.now();
        renderTimeline();
    }

    // Runner death handler (keeps surviving players running!)
    function handleLocalMultiplayerDeath(timeMs) {
        if (!MP.inMatch || !MPX.roundActive || MPX.dead[myProfile.id] !== undefined) return;
        MPX.dead[myProfile.id] = timeMs;
        MPX.live[myProfile.id] = timeMs;

        sendRoomMessage({ type: 'player_death', sender: myProfile, timeMs: timeMs, round: MPX.round });
        if (MP.inMatch) {
            const hero = window.game && window.game.hero;
            const heroBody = hero && hero.body;
            sendRoomMessage({
                type: 'coop_pos',
                sender: myProfile,
                x: heroBody ? heroBody.x : 0,
                y: 0,
                z: heroBody ? heroBody.z : 0,
                anim: 'fall',
                alive: false,
                round: MPX.round
            });
        }
        suppressRevive(true);
        showWaitHUD(timeMs, false);
        renderTimeline();

        if (MP.isPartyLeader) hostCheckRoundEnd();
    }

    function handlePlayerDeath(msg) {
        if (!MP.inMatch || msg.round !== MPX.round || !msg.sender) return;
        if (MPX.dead[msg.sender.id] !== undefined) return;
        MPX.dead[msg.sender.id] = msg.timeMs;
        MPX.live[msg.sender.id] = msg.timeMs;
        renderTimeline();
        if (MP.isPartyLeader) hostCheckRoundEnd();
    }

    function suppressRevive(on) {
        clearInterval(MPX.suppressTimer);
        if (!on) return;
        MPX.suppressTimer = setInterval(() => {
            try {
                ['saveme', 'gameover'].forEach(k => {
                    const s = window.app && window.app[k];
                    if (s && s.opened && s.close) s.close();
                });
            } catch (e) {}
        }, 100);
    }

    function showWaitHUD(roundTimeMs) {
        window.showWaitHUD = showWaitHUD;
        removeEl('subway-wait-hud');
        if (MPX.isPracticing) return;

        const prevTotal = MPX.totals[myProfile.id] || 0;
        const totalNow = prevTotal + roundTimeMs;

        const h = document.createElement('div');
        h.id = 'subway-wait-hud';
        h.className = 'subway-wait-overlay';

        const getRunnersListHTML = () => {
            const alive = MP.party.filter(p => MPX.dead[p.id] === undefined && p.id !== myProfile.id);
            if (!alive.length) return '<div class="wait-no-alive">Todos os corredores caíram! Finalizando rodada...</div>';
            return alive.map(p => `
                <div class="wait-live-runner-row">
                    <img class="wait-runner-avatar" src="${p.avatar}" alt="" />
                    <span class="wait-runner-name">${p.nick}</span>
                    <span class="wait-runner-time">${fmtS(MPX.live[p.id] || 0)}</span>
                    <span class="wait-runner-tag">CORRENDO</span>
                </div>
            `).join('');
        };

        h.innerHTML = `
            <div class="wait-card">
                <div class="wait-card-header">
                    <span class="wait-pulse-dot"></span>
                    <span class="wait-header-title">RODADA EM ANDAMENTO</span>
                    <span class="wait-round-badge">RODADA ${MPX.round}/${MPX.totalRounds}</span>
                </div>

                <div class="wait-stats-row">
                    <div class="wait-stat-box">
                        <span class="wait-stat-lbl">Seu Tempo nesta Rodada</span>
                        <span class="wait-stat-val val-cyan">${fmtS(roundTimeMs)}</span>
                    </div>
                    <div class="wait-stat-box">
                        <span class="wait-stat-lbl">Total Acumulado</span>
                        <span class="wait-stat-val val-gold">${fmtS(totalNow)}</span>
                    </div>
                </div>

                <div class="wait-runners-section">
                    <span class="wait-section-lbl">CORREDORES AINDA NA PISTA:</span>
                    <div class="wait-runners-list" id="wait-live-runners">
                        ${getRunnersListHTML()}
                    </div>
                </div>

                <div class="wait-actions">
                    <button class="btn-wait-practice" onclick="window.__startPracticeMode()">
                        <span class="wait-act-icon">⚡</span>
                        <div class="wait-act-text">
                            <span class="wait-act-main">MODO TREINO</span>
                            <span class="wait-act-sub">Jogue o modo normal até a próxima rodada começar</span>
                        </div>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(h);

        clearInterval(MPX.waitUpdateTimer);
        MPX.waitUpdateTimer = setInterval(() => {
            const listEl = document.getElementById('wait-live-runners');
            if (!listEl) { clearInterval(MPX.waitUpdateTimer); return; }
            listEl.innerHTML = getRunnersListHTML();
        }, 300);
    }
    window.showWaitHUD = showWaitHUD;

    function restoreHeroMesh() {
        try {
            const hero = (window.game && window.game.hero) || (window.app && window.app.game && window.app.game.hero);
            if (!hero) return;
            if (hero.model && hero.model.container) {
                hero.model.container.visible = true;
                hero.model.container.alpha = 1;
                hero.model.container.renderable = true;
            }
            // Ensure running animation is playing smoothly
            if (hero.anim && hero.character) {
                if (hero.anim.currentAnimationClipName !== 'run3' && hero.anim.currentAnimationClipName !== 'jump' && hero.anim.currentAnimationClipName !== 'roll') {
                    try { hero.anim.play('run3', { loop: true }); } catch(e) {}
                }
            }
            if (hero.body) {
                hero.body.movable = true;
            }
        } catch (e) {}
    }
    window.restoreHeroMesh = restoreHeroMesh;





    window.__startPracticeMode = function() {
        MPX.isPracticing = true;
        clearInterval(MPX.waitUpdateTimer);
        removeEl('subway-wait-hud');
        suppressRevive(false);

        showPracticeHUD();

        try {
            if (window.app && window.app.user) window.app.user.tutorial = true;
            window.app.nav.toGame();
            setTimeout(restoreHeroMesh, 300);
            setTimeout(restoreHeroMesh, 800);
        } catch (e) {
            console.error('Error starting practice run:', e);
        }
    };

    let allowInternalNav = false;

    function showOnlineNotice(msg) {
        let el = document.getElementById('subway-online-notice');
        if (!el) {
            el = document.createElement('div');
            el.id = 'subway-online-notice';
            el.className = 'subway-online-notice';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el.__timer);
        el.__timer = setTimeout(() => {
            el.classList.remove('show');
        }, 2200);
    }

    function setupOnlineAntiPauseHooks() {
        if (window.__antiPauseHooksInstalled) return;
        window.__antiPauseHooksInstalled = true;

        const checkHookGame = () => {
            if (!window.app || !window.app.game) return;
            if (!window.app.game.__hookedPause) {
                window.app.game.__hookedPause = true;
                const origPause = window.app.game.pause;
                window.app.game.pause = function(...args) {
                    if (MP.inMatch && MPX.roundActive && !MPX.isPracticing) {
                        showOnlineNotice('⚠️ Pausa bloqueada na rodada online!');
                        return;
                    }
                    if (isRunActive && !deathFrozen && !isGamePaused) {
                        isGamePaused = true;
                        pauseStartedAt = performance.now();
                    }
                    return origPause.apply(this, args);
                };
            }
            if (!window.app.game.__hookedResume && typeof window.app.game.resume === 'function') {
                window.app.game.__hookedResume = true;
                const origResume = window.app.game.resume;
                window.app.game.resume = function(...args) {
                    const cd = args[0];
                    const res = origResume.apply(this, args);
                    // A contagem real só retoma quando a contagem regressiva (3s) termina e o jogo volta a RUNNING
                    if (!cd || cd === 0) {
                        if (isGamePaused) {
                            runStartTime += (performance.now() - pauseStartedAt);
                            isGamePaused = false;
                        }
                    }
                    return res;
                };
            }
            if (!window.app.game.__hookedRevive && typeof window.app.game.revive === 'function') {
                window.app.game.__hookedRevive = true;
                const origRevive = window.app.game.revive;
                window.app.game.revive = function(...args) {
                    const res = origRevive.apply(this, args);
                    restoreHeroMesh();
                    setTimeout(restoreHeroMesh, 100);
                    setTimeout(restoreHeroMesh, 400);
                    return res;
                };
            }
        };

        const checkHookSettings = () => {
            if (!window.app || !window.app.settings || window.app.settings.__hookedOpen) return;
            window.app.settings.__hookedOpen = true;
            ['open', 'onOpen'].forEach(fn => {
                if (typeof window.app.settings[fn] === 'function') {
                    const orig = window.app.settings[fn];
                    window.app.settings[fn] = function(...args) {
                        if (MP.inMatch && MPX.roundActive && !MPX.isPracticing) {
                            showOnlineNotice('⚠️ Pausa bloqueada na rodada online!');
                            return;
                        }
                        return orig.apply(this, args);
                    };
                }
            });
        };

        const checkHookNav = () => {
            if (!window.app || !window.app.nav || window.app.nav.__hookedTitle) return;
            window.app.nav.__hookedTitle = true;
            ['toTitleScreen', 'toIdleScreen'].forEach(fn => {
                if (typeof window.app.nav[fn] === 'function') {
                    const orig = window.app.nav[fn];
                    window.app.nav[fn] = function(...args) {
                        if (MP.inMatch && MPX.roundActive && !MPX.isPracticing && !allowInternalNav) {
                            showOnlineNotice('⚠️ Proibido sair durante a rodada online!');
                            return;
                        }
                        return orig.apply(this, args);
                    };
                }
            });
        };

        setInterval(() => {
            checkHookGame();
            checkHookSettings();
            checkHookNav();
        }, 1000);

        window.addEventListener('keydown', (e) => {
            if (MP.inMatch && MPX.roundActive && !MPX.isPracticing) {
                if (e.key === 'Escape' || e.code === 'Escape' || e.key === 'p' || e.key === 'P' || e.code === 'KeyP') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    showOnlineNotice('⚠️ Pausa bloqueada na rodada online!');
                }
            }
        }, true);
    }

    window.__stopPracticeMode = function() {
        MPX.isPracticing = false;
        removeEl('subway-practice-hud');
        suppressRevive(true);
        allowInternalNav = true;
        try {
            ['saveme', 'gameover'].forEach(k => { const s = window.app && window.app[k]; if (s && s.close) s.close(); });
            window.app.nav.toTitleScreen();
        } catch (e) {}
        allowInternalNav = false;
        if (MPX.roundActive && MP.inMatch) {
            showWaitHUD(MPX.dead[myProfile.id] || 0);
        }
    };

    function showPracticeHUD() {
        removeEl('subway-practice-hud');
        const d = document.createElement('div');
        d.id = 'subway-practice-hud';
        d.className = 'subway-practice-hud';
        d.innerHTML = `
            <div class="practice-pill">
                <span class="practice-pulse"></span>
                <span class="practice-lbl">MODO TREINO</span>
                <span class="practice-sep">·</span>
                <span class="practice-msg">Aguardando outros corredores...</span>
                <button class="btn-quit-practice" onclick="window.__stopPracticeMode()" title="Sair do treino">✕</button>
            </div>
        `;
        document.body.appendChild(d);
    }

    // Authoritative Host: only ends round when all active competitors have died
    function hostCheckRoundEnd() {
        if (!MP.isPartyLeader || !MP.inMatch || !MPX.roundActive || MPX.endedRound === MPX.round) return;

        // O tempo depois que alguém morre NÃO acaba: só acaba quando TODOS os corredores morrerem!
        const alive = MP.party.filter(p => MPX.dead[p.id] === undefined);

        if (alive.length === 0) {
            hostEndRound();
        }
    }

    function hostWatchdog() {
        if (!MP.isPartyLeader || !MP.inMatch || !MPX.roundActive) return;
        const now = Date.now();
        MP.party.forEach(p => {
            if (MPX.dead[p.id] !== undefined || isBot(p.id) || p.id === myProfile.id) return;
            const last = MPX.lastTick[p.id] || MPX.goAt + 15000;
            if (now - last > 12000) {
                const sender = { id: p.id, nick: p.nick, avatar: p.avatar };
                const m = { type: 'player_death', sender, timeMs: MPX.live[p.id] || 0, round: MPX.round };
                sendRoomMessage(m);
                handlePlayerDeath(m);
            }
        });
    }
    setInterval(hostWatchdog, 1500);

    function hostEndRound() {
        if (MPX.endedRound === MPX.round) return;

        const results = {};
        MP.party.forEach(p => {
            const rTime = MPX.dead[p.id] !== undefined ? MPX.dead[p.id] : (MPX.live[p.id] || 0);
            results[p.id] = rTime;
            // Acumula o tempo de duração de todas as rodadas
            MPX.totals[p.id] = (MPX.totals[p.id] || 0) + rTime;
        });

        // O que tiver mais tempo total acumulado ganha!
        const rankedIds = [...MP.party.map(p => p.id)].sort((a, b) => (MPX.totals[b] || 0) - (MPX.totals[a] || 0));
        const roundWinnerId = rankedIds[0];

        const isTournamentOver = MPX.round >= MPX.totalRounds;
        const tournamentWinnerId = isTournamentOver ? rankedIds[0] : null;

        const msg = {
            type: 'round_end',
            sender: myProfile,
            round: MPX.round,
            totalRounds: MPX.totalRounds,
            results: results,
            rankedIds: rankedIds,
            totals: MPX.totals,
            roundWinnerId: roundWinnerId,
            isTournamentOver: isTournamentOver,
            tournamentWinnerId: tournamentWinnerId,
            party: MP.party,
            delay: isTournamentOver ? 10 : 5 // Exatamente 5s entre uma rodada e outra
        };

        sendRoomMessage(msg);
        handleRoundEnd(msg);
    }

    function handleRoundEnd(msg) {
        if (!MP.inMatch || MPX.endedRound === msg.round) return;
        MPX.endedRound = msg.round;
        MPX.roundActive = false;
        MPX.totals = msg.totals || MPX.totals;
        MPX.wins = msg.wins || MPX.wins;
        MPX.eliminated = msg.eliminated || MPX.eliminated;
        MPX.activeIds = msg.activeIds || MPX.activeIds;
        if (msg.party && !MP.isPartyLeader) MP.party = msg.party.map(p => ({ ...p }));

        clearInterval(MPX.botTimer);
        clearInterval(MPX.waitUpdateTimer);
        if (MPX.isPracticing) {
            MPX.isPracticing = false;
            removeEl('subway-practice-hud');
            showHUDNotification('Rodada finalizada! Iniciando próxima fase...');
        }
        suppressRevive(false);
        removeEl('subway-wait-hud');

        const nameOf = id => { const p = MP.party.find(x => x.id === id); return p ? p.nick : id; };

        // Save round record
        saveRecord({
            date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString().slice(0, 5),
            mode: 'Torneio Eliminatório No Coin',
            timeMs: msg.results[myProfile.id] || 0,
            timeStr: formatTime(msg.results[myProfile.id] || 0),
            nick: `R${msg.round}/${MPX.totalRounds} — 1º ${nameOf(msg.roundWinnerId)}`
        });

        exitRunToTitle();
        renderTimeline();
        showInterlude(msg);
    }

    function exitRunToTitle() {
        allowInternalNav = true;
        MPX.isSpectating = false;
        removeEl('subway-spectator-hud');
        removeEl('subway-practice-hud');
        try {
            ['saveme', 'gameover'].forEach(k => { const s = window.app && window.app[k]; if (s && s.close) s.close(); });
        } catch (e) {}
        hideRunTimer();
        try { window.app.nav.toTitleScreen(); } catch (e) { try { window.app.nav.resetUi(); } catch (e2) {} }
        allowInternalNav = false;
    }

    function showInterlude(msg) {
        window.showInterlude = showInterlude;
        removeEl('subway-interlude');
        const nameOf = id => {
            const p = MP.party.find(x => x.id === id);
            return p || { id, nick: id, avatar: DEFAULT_AVATARS[0].url };
        };

        const isOver = !!msg.isTournamentOver;
        const champ = nameOf(msg.tournamentWinnerId || msg.roundWinnerId);

        let roundTitle = '';
        let roundSubtitle = '';
        if (isOver) {
            roundTitle = 'TORNEIO FINALIZADO';
            roundSubtitle = 'Resultado Oficial da Competição';
        } else {
            roundTitle = `RODADA ${msg.round} DE ${msg.totalRounds}`;
            roundSubtitle = 'Classificação por Tempo Acumulado';
        }

        const rows = (msg.rankedIds || []).map((id, i) => {
            const p = nameOf(id);
            const isChamp = isOver && id === msg.tournamentWinnerId;
            const roundT = msg.results[id] || 0;
            const totalT = msg.totals[id] || 0;
            const isMe = id === myProfile.id;

            let badgeHtml = '';
            if (isOver) {
                if (i === 0) badgeHtml = '<span class="il-badge il-champ">1º LUGAR</span>';
                else if (i === 1) badgeHtml = '<span class="il-badge il-silver">2º LUGAR</span>';
                else badgeHtml = `<span class="il-badge il-sub">${i + 1}º LUGAR</span>`;
            } else {
                if (i === 0) badgeHtml = '<span class="il-badge il-champ">LÍDER</span>';
                else badgeHtml = `<span class="il-badge il-sub">${i + 1}º</span>`;
            }

            return `
                <div class="il-row ${i === 0 ? 'il-winner-row' : ''} ${isMe ? 'il-me-row' : ''}">
                    <span class="il-pos ${i === 0 ? 'pos-1' : ''}">${i + 1}</span>
                    <img class="il-av" src="${p.avatar}" />
                    <div class="il-runner-col">
                        <span class="il-nick">${p.nick}${isMe ? '<span class="tag-you">VOCÊ</span>' : ''}</span>
                    </div>
                    <span class="il-r">+${fmtS(roundT)}</span>
                    <span class="il-t">${fmtS(totalT)}</span>
                    <div class="il-status-col">${badgeHtml}</div>
                </div>
            `;
        }).join('');

        const winnerSpotlight = isOver ? `
            <div class="il-winner-spotlight">
                <div class="il-trophy-ring">
                    <img class="il-champ-avatar" src="${champ.avatar}" />
                    <span class="il-crown">👑</span>
                </div>
                <div class="il-champ-info">
                    <span class="il-champ-label">CAMPEÃO DO TORNEIO</span>
                    <span class="il-champ-name">${champ.nick}</span>
                    <span class="il-champ-score">TEMPO TOTAL: ${fmtS(msg.totals[champ.id] || 0)}</span>
                </div>
            </div>
        ` : '';

        const box = document.createElement('div');
        box.id = 'subway-interlude';
        box.className = 'subway-interlude';
        box.innerHTML = `
            <div class="il-card">
                <div class="il-header">
                    <div class="il-title-wrap">
                        <span class="il-title">${roundTitle}</span>
                        <span class="il-subtitle">${roundSubtitle}</span>
                    </div>
                </div>

                ${winnerSpotlight}

                <div class="il-table-wrap">
                    <div class="il-head">
                        <span>#</span>
                        <span></span>
                        <span>CORREDOR</span>
                        <span style="text-align:right;">RODADA</span>
                        <span style="text-align:right; color:#38bdf8;">ACUMULADO</span>
                        <span style="text-align:right;">STATUS</span>
                    </div>
                    <div class="il-rows">${rows}</div>
                </div>

                <div class="il-footer-actions">
                    <span class="il-countdown-text">
                        ${isOver ? 'Retornando ao lobby em' : 'Próxima rodada em'} <strong id="il-sec">${msg.delay}</strong>s...
                    </span>
                    <button class="btn-il-lobby" onclick="window.__endSeriesNow()">
                        ${isOver ? 'VOLTAR AO LOBBY' : 'SAIR PARA O LOBBY'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(box);

        let left = msg.delay;
        const upd = () => { const s = document.getElementById('il-sec'); if (s) s.textContent = left; };
        clearInterval(MPX.interTimer);
        MPX.interTimer = setInterval(() => {
            left--;
            if (left > 0) { upd(); return; }
            clearInterval(MPX.interTimer);
            removeEl('subway-interlude');
            if (isOver) endSeries();
            else if (MP.isPartyLeader) hostBeginRound();
        }, 1000);
    }
    window.__runCountdown = runCountdown;
    window.showInterlude = showInterlude;

    window.__endSeriesNow = function() {
        clearInterval(MPX.interTimer);
        removeEl('subway-interlude');
        endSeries();
    };

    function endSeries() {
        MP.inMatch = false;
        MP.active = false;
        MPX.roundActive = false;
        MP.isReady = false;
        MP.party.forEach(p => { p.ready = isBot(p.id); p.rseq = 0; });
        MPX.myRseq = 0;
        MPX.eliminated = {};
        hideTimeline();
        removeEl('subway-final-banner');
        if (MP.isPartyLeader) syncPartyToAll();
        showHUDNotification('Torneio Finalizado! Veja o histórico em Recordes.');
        openUnifiedModal('multiplayer');
    }

    // ==========================================
    // VERTICAL TIMELINE WITH ELIMINATION DANGER ZONE
    // ==========================================
    function fmtS(ms) { return (ms / 1000).toFixed(1) + 's'; }

    function showTimeline() {
        let el = document.getElementById('subway-timeline');
        if (!el) {
            el = document.createElement('div');
            el.id = 'subway-timeline';
            el.className = 'subway-tl-wrap';
            el.innerHTML = `
                <div class="tl-panel">
                    <div class="tl-head-row">
                        <span class="tl-pulse-dot"></span>
                        <span class="tl-head" id="tl-head">RODADA ${Math.max(1, MPX.round)}/${MPX.totalRounds}</span>
                    </div>
                    <div class="tl-runners-list" id="tl-runners-list"></div>
                </div>
            `;
            document.body.appendChild(el);
        }
    }

    function hideTimeline() { removeEl('subway-timeline'); }

    function renderTimeline() {
        let el = document.getElementById('subway-timeline');
        if (!el) {
            showTimeline();
            el = document.getElementById('subway-timeline');
        }
        if (!el || !MP.inMatch || !MP.party.length) return;

        // Sort active competitors by total accumulated survival time
        const list = MP.party.map(p => {
            const base = MPX.totals[p.id] || 0;
            const isDead = MPX.dead[p.id] !== undefined;
            const roundCur = isDead ? (MPX.dead[p.id] || 0) : (MPX.live[p.id] || 0);
            const totalScore = base + roundCur;
            return { p, score: totalScore, roundCur, dead: isDead };
        }).sort((a, b) => b.score - a.score);

        const head = el.querySelector('#tl-head');
        if (head) {
            if (MP.matchType === '1v1') {
                head.textContent = '⚔️ DUELO 1V1';
            } else {
                head.textContent = `🏆 TORNEIO · RODADA ${Math.max(1, MPX.round)}/3`;
            }
        }

        const listContainer = el.querySelector('#tl-runners-list');
        if (!listContainer) return;

        listContainer.innerHTML = list.map((item, i) => {
            const isMe = item.p.id === myProfile.id;
            const isDead = item.dead;
            return `
                <div class="tl-runner-item ${isDead ? 'runner-dead' : 'runner-alive'} ${isMe ? 'runner-me' : ''}">
                    <span class="tl-pos ${i === 0 ? 'pos-gold' : ''}">${i + 1}</span>
                    <img class="tl-av" src="${item.p.avatar}" alt="" />
                    <span class="tl-name">${item.p.nick}${isMe ? '<span class="tl-you">VOCÊ</span>' : ''}</span>
                    <span class="tl-score ${isDead ? 'score-dead' : 'score-alive'}">
                        ${isDead ? 'CAIU · ' + fmtS(item.score) : fmtS(item.score)}
                    </span>
                </div>
            `;
        }).join('');
    }
    setInterval(() => { if (MP.inMatch) renderTimeline(); }, 400);
    window.showTimeline = showTimeline;
    window.renderTimeline = renderTimeline;

    // Keep legacy aliases
    function hideSpectatorHUD() { removeEl('subway-wait-hud'); }
    function hideLivePlacementHUD() { hideTimeline(); }


    // ==========================================
    // 8. UNIFIED MOD MENU & UI
    // ==========================================
    function createUnifiedUI() {
        // Vertical skate energy meter; click the meter or press B when full.
        // Minimalist Graphical Drawn Energy Widget (No words, pure icons)
        if (!document.getElementById('subway-energy-widget')) {
            const ew = document.createElement('div');
            ew.id = 'subway-energy-widget';
            ew.setAttribute('role', 'button');
            ew.setAttribute('aria-label', 'Ativar Skate');
            ew.innerHTML = `
                <div class="se-core">
                    <svg class="se-svg-deck" viewBox="0 0 32 32" width="24" height="24">
                        <path d="M6 16 C6 13.5, 9 12, 16 12 C23 12, 26 13.5, 26 16 C26 18.5, 23 20, 16 20 C9 20, 6 18.5, 6 16 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                        <circle cx="10" cy="20.5" r="1.8" fill="currentColor"/>
                        <circle cx="22" cy="20.5" r="1.8" fill="currentColor"/>
                        <path d="M16 8 L14 14.5 L17 14.5 L15 21" fill="none" stroke="#00e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span id="subway-energy-value" class="se-badge">0/8</span>
                </div>
                <div class="se-dots-ring">
                    <span class="se-dot"></span><span class="se-dot"></span>
                    <span class="se-dot"></span><span class="se-dot"></span>
                    <span class="se-dot"></span><span class="se-dot"></span>
                    <span class="se-dot"></span><span class="se-dot"></span>
                </div>
                <div class="se-pill-hint">B</div>
            `;
            ew.addEventListener('click', activateBoard);
            document.body.appendChild(ew);

            const toast = document.createElement('div');
            toast.id = 'subway-expansion-toast';
            document.body.appendChild(toast);

            updateEnergyHud();
        }

        // Minimalist Stopwatch Timer (Hidden by default, shown ONLY during active run)
        if (!document.getElementById('subway-top-timer-wrap')) {
            const timer = document.createElement('div');
            timer.id = 'subway-top-timer-wrap';
            timer.className = 'subway-top-timer-wrap';
            timer.style.display = 'none';
            timer.innerHTML = `
                <span id="subway-top-timer-val" class="timer-value">00:00.00</span>
                <span id="subway-mode-indicator" class="timer-badge ${window.NO_COIN_MODE ? 'badge-nocoin' : 'badge-normal'}">
                    ${window.NO_COIN_MODE ? 'NO COIN' : 'NORMAL'}
                </span>
            `;
            document.body.appendChild(timer);
        }

        // Blue Settings Icon Button (Bottom Left)
        if (!document.getElementById('btn-subway-unified-menu')) {
            const menuBtn = document.createElement('button');
            menuBtn.id = 'btn-subway-unified-menu';
            menuBtn.className = 'btn-subway-unified-menu';
            menuBtn.title = 'Configurações Mod Menu';
            menuBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
            menuBtn.onclick = () => openUnifiedModal('modes');
            document.body.appendChild(menuBtn);
        }

        // Direct Online Mode Button
        if (!document.getElementById('btn-subway-online-lobby')) {
            const onlBtn = document.createElement('button');
            onlBtn.id = 'btn-subway-online-lobby';
            onlBtn.className = 'btn-subway-online-lobby';
            onlBtn.title = 'Lobby Multiplayer Online';
            onlBtn.innerHTML = '<span class="status-dot"></span><span class="btn-text">ONLINE</span>';
            onlBtn.onclick = () => openUnifiedModal('multiplayer');
            document.body.appendChild(onlBtn);
        }

        
    }

    function updateModeBadgeUI() {
        const badge = document.getElementById('subway-mode-indicator');
        if (badge) {
            badge.className = `timer-badge ${window.NO_COIN_MODE ? 'badge-nocoin' : 'badge-normal'}`;
            badge.textContent = window.NO_COIN_MODE ? 'NO COIN' : 'NORMAL';
        }
    }

    
    

    
    // Hub Helpers: Copy Room Link, Join Room, Add Bot
    window.__copyRoomLink = function() {
        const code = (MP.roomId || '').replace('room_', '');
        const url = window.location.origin + window.location.pathname + '?room=' + code;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                showHUDNotification('📋 Link da sala copiado! Envie para seus amigos.');
            }).catch(() => {
                prompt('Copie o link da sala:', url);
            });
        } else {
            prompt('Copie o link da sala:', url);
        }
    };

    window.__joinRoomByInput = function() {
        const inp = document.getElementById('input-join-room');
        if (!inp || !inp.value.trim()) return;
        let clean = inp.value.trim().replace(/^#/, '').replace(/^room_/, '');
        if (!clean) return;
        const targetRoomId = 'room_' + clean;
        MP.roomId = targetRoomId;
        MP.currentRoomTopic = 'subwaysurf/room/' + targetRoomId;
        MP.isPartyLeader = false;
        MP.isReady = false;
        MP.party = [{ ...myProfile, ready: false, isLeader: false, rseq: 0 }];
        if (MP.mqtt && MP.mqtt.connected) MP.mqtt.subscribe(MP.currentRoomTopic);
        sendRoomMessage({ type: 'party_sync_req', sender: myProfile });
        showHUDNotification('Conectando à sala #' + clean + '...');
        renderPartySlots();
        updateRoomCodeUI();
    };

    window.__addTestBot = function() {
        if (!MP.isPartyLeader) { showHUDNotification('Apenas o líder pode adicionar bots.'); return; }
        const maxSlots = getMaxPartySize();
        if (MP.party.length >= maxSlots) {
            showHUDNotification(`Grupo cheio (máximo ${maxSlots} jogadores no modo ${MP.matchType === '1v1' ? 'Duelo 1v1' : 'Torneio'}).`);
            return;
        }
        const botNames = [
            { id: 'bot_alex', nick: 'Alex_Pro', avatar: DEFAULT_AVATARS[1].url },
            { id: 'bot_bia', nick: 'Bia_Surfer', avatar: DEFAULT_AVATARS[2].url },
            { id: 'bot_carlos', nick: 'Carlos_Speed', avatar: DEFAULT_AVATARS[3].url },
            { id: 'bot_dani', nick: 'Dani_Dash', avatar: DEFAULT_AVATARS[0].url },
            { id: 'bot_enzo', nick: 'Enzo_Runner', avatar: DEFAULT_AVATARS[1].url }
        ];
        const nextBot = botNames.find(b => !MP.party.some(p => p.id === b.id));
        if (!nextBot) { showHUDNotification('Limite de bots atingido.'); return; }
        const botObj = { ...nextBot, ready: false, isLeader: false, rseq: 0 };
        MP.party.push(botObj);
        renderPartySlots();
        setTimeout(() => {
            botObj.ready = true;
            syncPartyToAll();
            renderPartySlots();
            maybeAutoStart();
        }, 800);
        showHUDNotification('🤖 ' + nextBot.nick + ' adicionado ao grupo!');
    };

    function updateRoomCodeUI() {
        const el = document.getElementById('lobby-room-code');
        if (el) el.textContent = '#' + (MP.roomId || '').replace('room_', '').slice(0, 8);
    }

    window.__openUnifiedMenu = function(tab) {
        openUnifiedModal(tab || 'modes');
    };
    window.openUnifiedMenu = window.__openUnifiedMenu;

    function openUnifiedModal(defaultTab) {
        initMultiplayerEngine();

        let modal = document.getElementById('modal-unified-menu');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.className = 'subway-modal-backdrop';
        modal.id = 'modal-unified-menu';

        modal.innerHTML = `
            <div class="subway-modal-box unified-box">
                <div class="modal-header">
                    <div class="modal-header-branding">
                        <span class="modal-brand-title">SUBWAY SURFERS</span>
                        <span class="modal-brand-tag">ARENA</span>
                    </div>
                    <button class="btn-modal-close" id="btn-close-unified" title="Fechar">✕</button>
                </div>

                <!-- Tabs Navigation -->
                <div class="unified-tabs">
                    <button class="tab-btn" data-tab="modes" id="tab-btn-modes">MODOS DE JOGO</button>
                    <button class="tab-btn" data-tab="graphics" id="tab-btn-graphics">FLUIDEZ & VÍDEO</button>
                    <button class="tab-btn" data-tab="multiplayer" id="tab-btn-multiplayer">MULTIPLAYER</button>
                    <button class="tab-btn" data-tab="records" id="tab-btn-records">RECORDES</button>
                </div>

                <!-- Tab 1: Game Modes -->
                <div class="tab-pane" id="pane-modes">
                    <div class="mod-card">
                        <div class="mod-info">
                            <span class="mod-title">Modo Ilimitado</span>
                            <span class="mod-desc">Moedas, chaves, personagens e skates infinitos liberados</span>
                        </div>
                        <button class="btn-clean-toggle ${window.UNLIMITED_MODE ? 'toggle-active' : ''}" id="btn-toggle-unlimited">
                            <span class="toggle-indicator"></span>
                            <span class="toggle-label">${window.UNLIMITED_MODE ? 'ATIVADO' : 'DESATIVADO'}</span>
                        </button>
                    </div>

                    <div class="mod-card">
                        <div class="mod-info">
                            <span class="mod-title">Modo No Coin</span>
                            <span class="mod-desc">Moedas vermelhas — qualquer contato com moedas causa eliminação</span>
                        </div>
                        <button class="btn-clean-toggle ${window.NO_COIN_MODE ? 'toggle-active-danger' : ''}" id="btn-toggle-nocoin">
                            <span class="toggle-indicator"></span>
                            <span class="toggle-label">${window.NO_COIN_MODE ? 'ATIVADO' : 'DESATIVADO'}</span>
                        </button>
                    </div>
                </div>

                <!-- Tab 2: Graphics, Display & Fluidity (Native Subway Surfers Aesthetic) -->
                <div class="tab-pane" id="pane-graphics">
                    <!-- Unlimited FPS Setting -->
                    <div class="subway-setting-row" onclick="window.__cycleFPS()" title="Toque para alternar taxa de quadros">
                        <div class="btn-subway-glossy-box">
                            <svg class="glossy-icon" viewBox="0 0 24 24" width="26" height="26" fill="#ffffff">
                                <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                            </svg>
                        </div>
                        <div class="setting-text-col">
                            <span class="setting-title">Taxa de Quadros (FPS)</span>
                            <span class="setting-value" id="val-gfx-fps">${GFX_SETTINGS.fps === 'unlimited' ? 'Ilimitado (120Hz+)' : (GFX_SETTINGS.fps + ' FPS')}</span>
                        </div>
                    </div>

                    <!-- Fluid Animation Optimizer -->
                    <div class="subway-setting-row" onclick="window.__toggleSmoothAnim()" title="Toque para alternar fluidez de animação">
                        <div class="btn-subway-glossy-box">
                            <svg class="glossy-icon" viewBox="0 0 24 24" width="26" height="26" fill="#ffffff">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                            </svg>
                        </div>
                        <div class="setting-text-col">
                            <span class="setting-title">Fluidez das Animações</span>
                            <span class="setting-value" id="val-gfx-smooth">${GFX_SETTINGS.smoothAnim ? 'Ultra Fluido (120Hz Interpolação)' : 'Padrão (60Hz)'}</span>
                        </div>
                    </div>

                    <!-- Saturation Slider Card -->
                    <div class="subway-setting-card">
                        <div class="setting-card-header">
                            <div class="btn-subway-glossy-box small">
                                <svg class="glossy-icon" viewBox="0 0 24 24" width="20" height="20" fill="#ffffff">
                                    <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.22 19.64 10.56 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
                                </svg>
                            </div>
                            <div class="setting-text-col">
                                <span class="setting-title">Saturação de Cores</span>
                                <span class="setting-value" id="val-gfx-saturation">${GFX_SETTINGS.saturation}%</span>
                            </div>
                        </div>
                        <div class="sat-slider-wrap">
                            <input type="range" id="slider-saturation" min="50" max="200" step="5" value="${GFX_SETTINGS.saturation}" oninput="window.__setSaturation(this.value)" />
                            <div class="sat-presets-row">
                                <button class="btn-sat-chip" onclick="window.__setSaturation(70)">70% Suave</button>
                                <button class="btn-sat-chip" onclick="window.__setSaturation(100)">100% Padrão</button>
                                <button class="btn-sat-chip" onclick="window.__setSaturation(135)">135% Vívido</button>
                                <button class="btn-sat-chip" onclick="window.__setSaturation(170)">170% Intenso</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab 2: Online Multiplayer -->
                <div class="tab-pane" id="pane-multiplayer">
                    <!-- Clean Pro Top Bar: Room Status + User Profile + Quick Join -->
                    <div class="lobby-header-bar">
                        <div class="lobby-room-badge">
                            <span class="live-dot"></span>
                            <span class="room-lbl">SALA</span>
                            <span class="room-code-tag" id="lobby-room-code">#${(MP.roomId || '').replace('room_', '').slice(0, 8)}</span>
                            <button class="btn-copy-code" onclick="window.__copyRoomLink()" title="Copiar link da sala">Copiar</button>
                        </div>

                        <div class="lobby-user-profile">
                            <div class="user-avatar-wrap" onclick="window.__promptAvatarUrl()" title="Clique para alterar foto por URL">
                                <img id="lobby-my-avatar" src="${myProfile.avatar}" alt="Avatar" />
                                <span class="avatar-edit-icon" title="Inserir URL">✎</span>
                            </div>
                            <div class="user-meta-wrap">
                                <div class="user-fields-row">
                                    <input type="text" id="input-my-nick" value="${myProfile.nick}" maxlength="14" placeholder="Seu Nick" title="Clique para editar seu nick" onchange="window.__saveMyNick(this.value)" onblur="window.__saveMyNick(this.value)" />
                                    <input type="text" id="input-my-avatar-url" value="${myProfile.avatar.startsWith('http') ? myProfile.avatar : ''}" placeholder="URL da foto..." title="Cole o link da foto de perfil" onchange="window.__saveAvatarUrl(this.value)" onblur="window.__saveAvatarUrl(this.value)" />
                                </div>
                                <div class="avatar-dots-bar">
                                    ${DEFAULT_AVATARS.map(av => `
                                        <img class="avatar-dot-chip ${av.url === myProfile.avatar ? 'active' : ''}" src="${av.url}" title="${av.name}" onclick="window.__selectPresetAvatar('${av.url}')" />
                                    `).join('')}
                                    <button class="btn-avatar-url-chip" onclick="window.__promptAvatarUrl()" title="Inserir URL da foto">+ URL</button>
                                </div>
                            </div>
                        </div>

                        <div class="lobby-join-box">
                            <input type="text" id="input-join-room" placeholder="Código..." maxlength="15" />
                            <button class="btn-join-room" onclick="window.__joinRoomByInput()">Entrar</button>
                        </div>
                    </div>

                    <!-- Main Grid: Party Slots & Online List -->
                    <div class="lobby-grid">
                        <!-- Left: Party Roster (2-4 players) -->
                        <div class="lobby-column party-col">
                            <div class="mp-mode-toggle-group">
                                <button type="button" class="btn-mp-mode ${MP.matchType === '1v1' ? 'active' : ''}" data-mode="1v1" onclick="window.__setMPMatchType('1v1')">⚔️ Duelo 1v1</button>
                                <button type="button" class="btn-mp-mode ${MP.matchType === 'tournament' ? 'active' : ''}" data-mode="tournament" onclick="window.__setMPMatchType('tournament')">🏆 Torneio (5P)</button>
                            </div>

                            <div class="col-header">
                                <div class="col-title-wrap">
                                    <h3 id="lobby-party-title">${MP.matchType === '1v1' ? `DUELO 1V1 (${MP.party.length}/2)` : `TORNEIO (${MP.party.length}/5)`}</h3>
                                    <span class="party-hint" id="lobby-party-desc">${MP.matchType === '1v1' ? 'Duelo Direto 1v1 · 1 Rodada Única · Maior sobrevivência vence' : 'Torneio Competitivo · 3 Rodadas · Até 5 Jogadores · 5s entre rodadas'}</span>
                                </div>
                                <button class="btn-add-bot" onclick="window.__addTestBot()" title="Adicionar bot para treinar">+ Bot</button>
                            </div>

                            <div class="party-slots-container" id="party-slots">
                                <!-- Injected by renderPartySlots -->
                            </div>

                            <div class="party-bottom-actions">
                                <button id="btn-toggle-ready" class="btn-ready ${MP.isReady ? 'ready-on' : 'ready-off'}">
                                    ${MP.isReady ? 'ESTOU PRONTO ✓' : 'DAR PRONTO'}
                                </button>
                                <button id="btn-start-match" class="btn-start-match" ${checkCanStartMatch() ? '' : 'disabled'}>
                                    ${MP.matchType === '1v1' ? 'INICIAR DUELO 1V1' : 'INICIAR TORNEIO'}
                                </button>
                                <button id="btn-leave-party" class="btn-leave-room" onclick="window.__leaveParty()" title="Sair da sala">Sair</button>
                            </div>
                        </div>

                        <!-- Right: Online Players -->
                        <div class="lobby-column players-col">
                            <div class="col-header">
                                <div class="col-title-wrap">
                                    <h3>JOGADORES ONLINE</h3>
                                    <span class="party-hint">Convide corredores para a sala</span>
                                </div>
                                <button class="btn-refresh-online" onclick="window.__refreshOnline()" title="Atualizar lista">Atualizar</button>
                            </div>
                            <div class="online-players-list" id="online-players-list">
                                <!-- Injected by renderOnlinePlayersList -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab 3: Records History -->
                <div class="tab-pane" id="pane-records">
                    <div class="records-filter-bar">
                        <button class="btn-filter-record active" onclick="window.__filterRecords('global', this)">🏆 GLOBAL TOP</button>
                        <button class="btn-filter-record" onclick="window.__filterRecords('nocoin', this)">NO COIN</button>
                        <button class="btn-filter-record" onclick="window.__filterRecords('normal', this)">NORMAL</button>
                        <button class="btn-filter-record" onclick="window.__filterRecords('local', this)">HISTÓRICO LOCAL</button>
                        <button class="btn-clear-records" onclick="window.__clearRecords()">LIMPAR LOCAL</button>
                    </div>
                    <div class="records-table-container" id="records-table-wrap">
                        <!-- Injected by renderRecordsTable -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) closeUnifiedModal();
        };

        // Bind tab buttons
        const tabs = modal.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.onclick = () => switchTab(btn.getAttribute('data-tab'));
        });

        document.getElementById('btn-close-unified').onclick = closeUnifiedModal;
        document.getElementById('btn-toggle-unlimited').onclick = toggleUnlimitedMode;
        document.getElementById('btn-toggle-nocoin').onclick = toggleNoCoinMode;
        const btnSave = document.getElementById('btn-save-profile'); if (btnSave) btnSave.onclick = saveLobbyProfile;
        document.getElementById('btn-toggle-ready').onclick = toggleReady;
        document.getElementById('btn-start-match').onclick = requestStartMatch;

        switchTab(defaultTab || 'modes');
        renderPartySlots();
        renderOnlinePlayersList();
        renderRecordsTable('global');
    }

    function switchTab(tabName) {
        const modal = document.getElementById('modal-unified-menu');
        if (!modal) return;
        modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });
        modal.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === 'pane-' + tabName);
        });
    }

    function closeUnifiedModal() {
        const modal = document.getElementById('modal-unified-menu');
        if (modal) modal.remove();
    }

    function toggleUnlimitedMode() {
        window.UNLIMITED_MODE = !window.UNLIMITED_MODE;
        localStorage.setItem('subway_unlimited_v2', window.UNLIMITED_MODE ? 'true' : 'false');
        if (!window.UNLIMITED_MODE) {
            resetUnlimitedStorage();
            try { if (window.app && window.app.user && window.app.user.gameSettings && window.app.user.gameSettings.currencies) { window.app.user.gameSettings.currencies.coins = 0; window.app.user.gameSettings.currencies.keys = 0; } } catch(e) {}
        }
        if (window.UNLIMITED_MODE) {
            applyUnlimitedStorage();
            if (window.app && window.app.user) applyUnlockToUser(window.app.user);
            showHUDNotification('⚡ MODO ILIMITADO ATIVADO! (Moedas e Chaves Infinitas)');
        } else {
            showHUDNotification('Modo Ilimitado desativado.');
        }
        const btn = document.getElementById('btn-toggle-unlimited');
        if (btn) {
            btn.className = `btn-clean-toggle ${window.UNLIMITED_MODE ? 'toggle-active' : ''}`;
            btn.innerHTML = `<span class="toggle-indicator"></span><span class="toggle-label">${window.UNLIMITED_MODE ? 'ATIVADO' : 'DESATIVADO'}</span>`;
        }
    }

    function toggleNoCoinMode() {
        window.NO_COIN_MODE = !window.NO_COIN_MODE;
        window.GAME_MODE = window.NO_COIN_MODE ? 'nocoin' : 'normal';
        localStorage.setItem('subway_game_mode', window.GAME_MODE);
        updateModeBadgeUI();

        const btn = document.getElementById('btn-toggle-nocoin');
        if (btn) {
            btn.className = `btn-clean-toggle ${window.NO_COIN_MODE ? 'toggle-active-danger' : ''}`;
            btn.innerHTML = `<span class="toggle-indicator"></span><span class="toggle-label">${window.NO_COIN_MODE ? 'ATIVADO' : 'DESATIVADO'}</span>`;
        }
        if (window.__activeCoins) {
            for (const coin of window.__activeCoins) {
                if (coin && coin._isDashItem) continue; // NEVER recolor green dash coins
                if (coin && coin.model) {
                    setEntityHexColor(coin.model, window.NO_COIN_MODE ? 0xff1e1e : 0xffffff);
                }
                if (coin && coin.shine) {
                    coin.shine.active = !window.NO_COIN_MODE;
                }
            }
        }
        for (const obs of customObstacles) {
            if (obs && obs.type === 'coin' && obs.mesh) {
                setEntityHexColor(obs.mesh, window.NO_COIN_MODE ? 0xff1e1e : 0xffffff);
            }
        }
        showHUDNotification(window.NO_COIN_MODE ? '🔴 MODO NO COIN ATIVADO! Cuidado com as moedas vermelhas!' : '🟡 MODO NORMAL ATIVADO!');
    }

    window.__saveAvatarUrl = function(url) {
        if (!url || !url.trim()) return;
        url = url.trim();
        myProfile.avatar = url;
        const img = document.getElementById('lobby-my-avatar');
        if (img) img.src = url;
        const inp = document.getElementById('input-my-avatar-url');
        if (inp) inp.value = url;
        localStorage.setItem('subway_surfers_profile', JSON.stringify(myProfile));
        const me = MP.party.find(p => p.id === myProfile.id);
        if (me) me.avatar = url;
        document.querySelectorAll('.avatar-dot-chip').forEach(el => el.classList.remove('active'));
        renderPartySlots();
        broadcastPresence();
        showHUDNotification('Foto de perfil atualizada!');
    };

    window.__promptAvatarUrl = function() {
        const cur = (myProfile.avatar && myProfile.avatar.startsWith('http')) ? myProfile.avatar : '';
        const res = prompt('Insira o link direto (URL) da sua foto de perfil:', cur);
        if (res && res.trim()) {
            window.__saveAvatarUrl(res.trim());
        }
    };

    window.__saveMyNick = function(val) {
        if (!val || !val.trim()) return;
        myProfile.nick = val.trim();
        localStorage.setItem('subway_surfers_profile', JSON.stringify(myProfile));
        const me = MP.party.find(p => p.id === myProfile.id);
        if (me) me.nick = myProfile.nick;
        renderPartySlots();
        broadcastPresence();
        showHUDNotification('Nickname atualizado!');
    };

    window.__selectPresetAvatar = function(url) {
        myProfile.avatar = url;
        const img = document.getElementById('lobby-my-avatar');
        if (img) img.src = url;
        localStorage.setItem('subway_surfers_profile', JSON.stringify(myProfile));
        const me = MP.party.find(p => p.id === myProfile.id);
        if (me) me.avatar = url;
        document.querySelectorAll('.avatar-dot-chip').forEach(el => {
            el.classList.toggle('active', el.getAttribute('src') === url);
        });
        renderPartySlots();
        broadcastPresence();
        showHUDNotification('Avatar atualizado!');
    };

    window.__refreshOnline = function() {
        broadcastPresence();
        renderOnlinePlayersList();
    };

    function saveLobbyProfile() {
        const nickInput = document.getElementById('input-my-nick');
        const avatarInput = document.getElementById('input-my-avatar');
        if (nickInput && nickInput.value.trim()) {
            myProfile.nick = nickInput.value.trim();
        }
        if (avatarInput && avatarInput.value.trim()) {
            myProfile.avatar = avatarInput.value.trim();
        }
        localStorage.setItem('subway_surfers_profile', JSON.stringify(myProfile));

        const me = MP.party.find(p => p.id === myProfile.id);
        if (me) {
            me.nick = myProfile.nick;
            me.avatar = myProfile.avatar;
        }
        renderPartySlots();
        broadcastPresence();
        showHUDNotification('✅ Perfil salvo!');
    }

    function renderPartySlots() {
        const container = document.getElementById('party-slots');
        if (!container) return;

        let html = '';
        const maxSlots = getMaxPartySize();
        for (let i = 0; i < maxSlots; i++) {
            const player = MP.party[i];
            if (player) {
                const isMe = player.id === myProfile.id;
                const isReady = !!player.ready;
                const isLeader = !!player.isLeader;
                const isThisBot = isBot(player.id);
                html += `
                    <div class="party-slot slot-filled ${isReady ? 'slot-ready' : 'slot-waiting'} ${isMe ? 'slot-me' : ''}">
                        <div class="slot-idx">${i + 1}</div>
                        <div class="slot-avatar" style="background-image: url('${player.avatar}')">
                            ${isLeader ? '<span class="crown-icon" title="Líder">👑</span>' : ''}
                        </div>
                        <div class="slot-details">
                            <div class="slot-nick-row">
                                <span class="slot-nick">${player.nick}</span>
                                ${isMe ? '<span class="tag-you">VOCÊ</span>' : ''}
                                ${isThisBot ? '<span class="tag-bot">BOT</span>' : ''}
                            </div>
                        </div>
                        <div class="slot-right">
                            <span class="slot-status-pill ${isReady ? 'st-ready' : 'st-waiting'}">
                                ${isReady ? 'PRONTO' : 'AGUARDANDO'}
                            </span>
                            ${!isMe && MP.isPartyLeader ? `<button class="btn-kick" title="Expulsar" onclick="window.__kickPlayer('${player.id}')">✕</button>` : ''}
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="party-slot slot-empty">
                        <div class="slot-idx">${i + 1}</div>
                        <span class="empty-label">Vaga disponível</span>
                        <button class="btn-slot-add-bot" onclick="window.__addTestBot()" title="Adicionar bot">+ Bot</button>
                    </div>
                `;
            }
        }
        container.innerHTML = html;
        updateLobbyHeaderTitles();

        const startBtn = document.getElementById('btn-start-match');
        if (startBtn) {
            const canStart = checkCanStartMatch();
            startBtn.disabled = !canStart;
            startBtn.classList.toggle('can-start', canStart);
        }

        const readyBtn = document.getElementById('btn-toggle-ready');
        if (readyBtn) {
            readyBtn.className = `btn-ready ${MP.isReady ? 'ready-on' : 'ready-off'}`;
            readyBtn.textContent = MP.isReady ? 'ESTOU PRONTO ✓' : 'DAR PRONTO';
        }
    }

    window.__kickPlayer = function(playerId) {
        MP.party = MP.party.filter(p => p.id !== playerId);
        syncPartyToAll();
        renderPartySlots();
    };

    function renderOnlinePlayersList() {
        const container = document.getElementById('online-players-list');
        if (!container) return;

        const activeOnline = [];
        MP.onlinePlayers.forEach(entry => {
            activeOnline.push(entry.profile);
        });

        // Mock bots for instant solo testing if no one is online
        if (activeOnline.length < 3) {
            const botPresets = [
                { id: 'bot_alex', nick: 'Alex_Pro', avatar: DEFAULT_AVATARS[1].url },
                { id: 'bot_beatriz', nick: 'Bia_Surfer', avatar: DEFAULT_AVATARS[2].url },
                { id: 'bot_carlos', nick: 'Carlos_Speed', avatar: DEFAULT_AVATARS[3].url }
            ];
            botPresets.forEach(b => {
                if (!activeOnline.some(o => o.id === b.id) && !MP.party.some(p => p.id === b.id)) {
                    activeOnline.push(b);
                }
            });
        }

        if (activeOnline.length === 0) {
            container.innerHTML = '<div class="no-players">Procurando corredores online...</div>';
            return;
        }

        container.innerHTML = activeOnline.map(p => {
            const inMyParty = MP.party.some(mem => mem.id === p.id);
            return `
                <div class="player-card">
                    <img class="card-avatar" src="${p.avatar}" />
                    <div class="card-nick">${p.nick}</div>
                    <button class="btn-invite" ${inMyParty ? 'disabled' : ''} onclick="window.__invitePlayer('${p.id}', '${p.nick}', '${p.avatar}')">
                        ${inMyParty ? 'No Grupo' : '➕ Convidar'}
                    </button>
                </div>
            `;
        }).join('');
    }

    window.__invitePlayer = function(id, nick, avatar) {
        if (!MP.isPartyLeader) { showHUDNotification('Só o líder do grupo pode convidar.'); return; }
        if (MP.inMatch) return;
        const target = { id, nick, avatar, rseq: 0, isLeader: false };
        // Bot auto join for testing
        if (id.startsWith('bot_')) {
            if (MP.party.length < getMaxPartySize()) {
                target.ready = false;
                MP.party.push(target);
                renderPartySlots();
                setTimeout(() => {
                    target.ready = true;
                    syncPartyToAll();
                    renderPartySlots();
                    maybeAutoStart();
                }, 1000);
            }
            return;
        }

        // Send invite to real online player
        sendGlobalMessage('subwaysurf/player/' + id, {
            type: 'invite',
            sender: myProfile,
            roomId: MP.roomId
        });
        showHUDNotification('Convite enviado para ' + nick + '!');
    };

    // Records Table Rendering
    function renderRecordsTable(filterMode) {
        const container = document.getElementById('records-table-wrap');
        if (!container) return;
        window.__currentRecordFilter = filterMode || 'global';

        let records = [];
        const isGlobal = (filterMode === 'global' || !filterMode);

        if (isGlobal) {
            records = getGlobalLeaderboard();
        } else if (filterMode === 'nocoin') {
            const globalNc = getGlobalLeaderboard().filter(r => r.mode === 'No Coin');
            const localNc = JSON.parse(localStorage.getItem('subway_surfers_records') || '[]').filter(r => r.mode === 'No Coin');
            const map = new Map();
            [...globalNc, ...localNc].forEach(r => {
                const k = (r.nick || 'Você') + '_' + r.mode;
                if (!map.has(k) || r.timeMs > map.get(k).timeMs) map.set(k, r);
            });
            records = Array.from(map.values()).sort((a, b) => b.timeMs - a.timeMs);
        } else if (filterMode === 'normal') {
            const globalNm = getGlobalLeaderboard().filter(r => r.mode === 'Normal');
            const localNm = JSON.parse(localStorage.getItem('subway_surfers_records') || '[]').filter(r => r.mode === 'Normal');
            const map = new Map();
            [...globalNm, ...localNm].forEach(r => {
                const k = (r.nick || 'Você') + '_' + r.mode;
                if (!map.has(k) || r.timeMs > map.get(k).timeMs) map.set(k, r);
            });
            records = Array.from(map.values()).sort((a, b) => b.timeMs - a.timeMs);
        } else {
            // Local history
            records = JSON.parse(localStorage.getItem('subway_surfers_records') || '[]');
        }

        if (records.length === 0) {
            container.innerHTML = '<div class="no-records">Nenhum recorde registrado ainda. Inicie uma corrida para pontuar!</div>';
            return;
        }

        container.innerHTML = `
            <table class="records-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Jogador</th>
                        <th>Modo</th>
                        <th>Tempo</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map((r, i) => {
                        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
                        const rankIcon = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `#${i + 1}`;
                        const isMe = r.id === myProfile.id || r.nick === myProfile.nick;
                        return `
                        <tr class="${rankClass} ${isMe ? 'row-me' : ''}">
                            <td class="td-rank"><strong>${rankIcon}</strong></td>
                            <td class="td-player">
                                <div class="rec-player-cell">
                                    <img class="rec-avatar" src="${r.avatar || myProfile.avatar || DEFAULT_AVATARS[0].url}" alt="" />
                                    <span>${r.nick || myProfile.nick}</span>
                                    ${isMe ? '<span class="rec-you-tag">VOCÊ</span>' : ''}
                                </div>
                            </td>
                            <td><span class="badge ${r.mode === 'No Coin' ? 'b-nocoin' : 'b-normal'}">${r.mode}</span></td>
                            <td class="td-time">${r.timeStr || formatTime(r.timeMs || 0)}</td>
                            <td class="td-date">${r.date || 'Hoje'}</td>
                        </tr>
                    `;}).join('')}
                </tbody>
            </table>
        `;
    }

    window.__filterRecords = function(mode, btn) {
        document.querySelectorAll('.btn-filter-record').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderRecordsTable(mode);
    };

    window.__clearRecords = function() {
        if (confirm('Deseja realmente apagar todo o histórico de recordes?')) {
            localStorage.removeItem('subway_surfers_records');
            renderRecordsTable('global');
        }
    };

    // ==========================================
    // 9. CSS STYLES INJECTION
    // ==========================================
    function injectModStyles() {
        const style = document.createElement('style');
        style.textContent = `
            
            /* Vertical skate energy meter */
                        /* Minimalist Drawn Graphical Energy Widget */
            #subway-energy-widget {
                position: fixed;
                right: 20px;
                top: 190px;
                z-index: 99990;
                width: 52px;
                height: 74px;
                padding: 6px 4px;
                border-radius: 18px;
                background: rgba(8, 18, 30, 0.88);
                backdrop-filter: blur(10px);
                border: 1.5px solid rgba(0, 229, 255, 0.35);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.1);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                user-select: none;
                touch-action: manipulation;
                box-sizing: border-box;
                transition: border-color 0.25s, box-shadow 0.25s, transform 0.2s;
            }
            #subway-energy-widget:hover {
                transform: translateY(-2px);
                border-color: rgba(0, 229, 255, 0.7);
            }
            #subway-energy-widget:active {
                transform: scale(0.95);
            }
            #subway-energy-widget .se-core {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }
            #subway-energy-widget .se-svg-deck {
                color: #7dd3fc;
                filter: drop-shadow(0 0 4px rgba(0, 229, 255, 0.4));
                transition: color 0.25s, filter 0.25s;
            }
            #subway-energy-widget .se-badge {
                font: 800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
                color: #bae6fd;
                letter-spacing: -0.3px;
                line-height: 10px;
            }
            #subway-energy-widget .se-dots-ring {
                display: flex;
                gap: 3px;
                align-items: center;
                justify-content: center;
                width: 100%;
                padding: 0 2px;
            }
            #subway-energy-widget .se-dot {
                width: 3.5px;
                height: 8px;
                border-radius: 2px;
                background: rgba(255, 255, 255, 0.12);
                transition: background 0.2s, box-shadow 0.2s;
            }
            #subway-energy-widget .se-dot.filled {
                background: #00e5ff;
                box-shadow: 0 0 6px #00e5ff;
            }
            #subway-energy-widget .se-pill-hint {
                font: 900 9px Arial, sans-serif;
                color: #38bdf8;
                padding: 1px 7px;
                border-radius: 6px;
                background: rgba(0, 229, 255, 0.12);
                border: 1px solid rgba(0, 229, 255, 0.25);
            }
            #subway-energy-widget.is-ready {
                border-color: #00e5ff;
                box-shadow: 0 0 18px rgba(0, 229, 255, 0.8), inset 0 0 10px rgba(0, 229, 255, 0.25);
                animation: seWidgetPulse 1.2s infinite alternate;
            }
            #subway-energy-widget.is-ready .se-svg-deck {
                color: #ffffff;
                filter: drop-shadow(0 0 8px #00e5ff);
            }
            #subway-energy-widget.is-ready .se-pill-hint {
                background: #00e5ff;
                color: #041420;
                border-color: #ffffff;
                box-shadow: 0 0 8px #00e5ff;
            }
            #subway-energy-widget.is-active {
                border-color: #fbbf24;
                box-shadow: 0 0 18px rgba(251, 191, 36, 0.7);
            }
            #subway-energy-widget.is-active .se-svg-deck {
                color: #fde68a;
                filter: drop-shadow(0 0 8px #f59e0b);
            }
            #subway-energy-widget.is-active .se-dot.filled {
                background: #f59e0b;
                box-shadow: 0 0 6px #f59e0b;
            }
            @keyframes seWidgetPulse {
                0% { box-shadow: 0 0 10px rgba(0, 229, 255, 0.5); }
                100% { box-shadow: 0 0 22px rgba(0, 229, 255, 0.95); }
            }

            /* Minimalist Floating Bottom Toast */
            #subway-expansion-toast {
                position: fixed;
                left: 50%;
                bottom: 74px;
                transform: translate(-50%, 12px);
                opacity: 0;
                z-index: 100000;
                padding: 4px 14px;
                border-radius: 999px;
                background: rgba(6, 16, 28, 0.88);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(0, 229, 255, 0.45);
                color: #e0f9ff;
                font: 800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
                letter-spacing: 0.5px;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.55), 0 0 10px rgba(0, 229, 255, 0.25);
                pointer-events: none;
                transition: opacity 0.16s ease, transform 0.16s ease;
            }
            #subway-expansion-toast.show {
                opacity: 1;
                transform: translate(-50%, 0);
            }
            @media (max-width: 600px) {
                #subway-energy-widget { top: 150px; right: 12px; width: 48px; height: 68px; }
                #subway-expansion-toast { bottom: 62px; font-size: 10px; padding: 3px 12px; }
            }

            /* Map Themes */
            .map-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                gap: 8px;
                width: 100%;
                margin-top: 8px;
            }
            .btn-map-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.06);
                border: 2px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                padding: 10px 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                color: #fff;
                font-family: inherit;
                text-align: center;
            }
            .btn-map-item:hover {
                background: rgba(0, 195, 255, 0.15);
                border-color: rgba(0, 195, 255, 0.5);
                transform: translateY(-2px);
            }
            .btn-map-item.active-map {
                background: linear-gradient(135deg, rgba(0, 195, 255, 0.3), rgba(0, 102, 255, 0.3));
                border-color: #00c3ff;
                box-shadow: 0 0 12px rgba(0, 195, 255, 0.4);
            }
            .btn-map-item .map-icon { font-size: 24px; margin-bottom: 4px; }
            .btn-map-item .map-name { font-size: 13px; font-weight: 700; }
            .btn-map-item .map-desc { font-size: 10px; color: #a0aec0; margin-top: 2px; }

            /* World Tour Notification Banner */
            .world-tour-banner {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(-100px);
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
                border: 2px solid #00c3ff;
                border-radius: 30px;
                padding: 8px 24px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 999999;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 195, 255, 0.3);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease;
                opacity: 0;
                pointer-events: none;
                color: #fff;
            }
            .world-tour-banner.show {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            .world-tour-banner .wt-icon { font-size: 26px; }
            .world-tour-banner .wt-info { display: flex; flex-direction: column; }
            .world-tour-banner .wt-label { font-size: 9px; letter-spacing: 2px; color: #38bdf8; font-weight: 800; }
            .world-tour-banner .wt-city { font-size: 14px; font-weight: 900; letter-spacing: 1px; color: #fff; }

            
            /* Canvas Saturation & Visual Fidelity */
            canvas {
                touch-action: manipulation !important;
                -webkit-touch-callout: none !important;
                user-select: none !important;
                filter: saturate(var(--game-saturation, 100%)) !important;
            }

            /* Native Subway Surfers Glossy Blue Button System */
            .subway-setting-row {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 12px 16px;
                margin-bottom: 12px;
                background: rgba(15, 23, 42, 0.65);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                cursor: pointer;
                user-select: none;
                transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s ease;
                touch-action: manipulation;
            }
            .subway-setting-row:hover {
                background: rgba(30, 41, 59, 0.85);
                border-color: rgba(56, 189, 248, 0.3);
            }
            .subway-setting-row:active {
                transform: scale(0.98);
            }

            /* Exact Subway Surfers Blue Glossy Square Icon Button */
            .btn-subway-glossy-box {
                width: 56px;
                height: 56px;
                min-width: 56px;
                border-radius: 14px;
                background: linear-gradient(180deg, #44a2e8 0%, #1c7cd6 50%, #1562b5 100%);
                border: 2px solid #ffffff;
                outline: 3px solid #94b8d7;
                outline-offset: 0;
                box-shadow: 0 4px 0 #0d437a, 0 6px 12px rgba(0, 0, 0, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.65);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                flex-shrink: 0;
                transition: transform 0.1s ease, box-shadow 0.1s ease;
            }
            .btn-subway-glossy-box.small {
                width: 44px;
                height: 44px;
                min-width: 44px;
                border-radius: 11px;
                outline-width: 2.5px;
            }
            .subway-setting-row:active .btn-subway-glossy-box {
                transform: translateY(2px);
                box-shadow: 0 2px 0 #0d437a, 0 3px 6px rgba(0, 0, 0, 0.3), inset 0 2px 2px rgba(255, 255, 255, 0.65);
            }
            .btn-subway-glossy-box .glossy-icon {
                filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
                pointer-events: none;
            }

            /* Setting Text Column */
            .setting-text-col {
                display: flex;
                flex-direction: column;
                justify-content: center;
                flex: 1;
            }
            .setting-title {
                font-size: 17px;
                font-weight: 900;
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                letter-spacing: -0.2px;
                line-height: 1.2;
            }
            .setting-value {
                font-size: 14px;
                font-weight: 800;
                color: #38bdf8;
                margin-top: 3px;
                letter-spacing: 0.2px;
            }

            /* Saturation Slider Card */
            .subway-setting-card {
                padding: 14px 16px;
                margin-bottom: 12px;
                background: rgba(15, 23, 42, 0.65);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
            }
            .setting-card-header {
                display: flex;
                align-items: center;
                gap: 14px;
                margin-bottom: 12px;
            }
            .sat-slider-wrap {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 0 4px;
            }
            .sat-slider-wrap input[type="range"] {
                width: 100%;
                height: 8px;
                border-radius: 4px;
                background: #1e293b;
                outline: none;
                accent-color: #38bdf8;
                cursor: pointer;
            }
            .sat-presets-row {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .btn-sat-chip {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #cbd5e1;
                font-size: 11px;
                font-weight: 700;
                padding: 5px 10px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.15s ease;
                font-family: inherit;
            }
            .btn-sat-chip:hover {
                background: #38bdf8;
                color: #0f172a;
                border-color: #38bdf8;
            }

            /* Clean Non-AI Stopwatch HUD */
            .subway-top-timer-wrap {
                position: fixed;
                top: 14px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                display: none;
                align-items: center;
                gap: 10px;
                padding: 5px 14px;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 9999px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
                user-select: none;
                pointer-events: none;
            }
            .subway-top-timer-wrap .timer-value {
                font-size: 15px;
                font-weight: 800;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-variant-numeric: tabular-nums;
                color: #ffffff;
                letter-spacing: 0.5px;
            }
            .subway-top-timer-wrap .timer-badge {
                font-size: 10px;
                font-weight: 800;
                padding: 2px 7px;
                border-radius: 6px;
                letter-spacing: 0.6px;
                text-transform: uppercase;
            }
            .badge-nocoin {
                background: #e11d48;
                color: #ffffff;
            }
            .badge-normal {
                background: rgba(255, 255, 255, 0.12);
                color: #cbd5e1;
            }

                        /* Minimalist & Professional Clean Countdown */
            .subway-countdown-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(2, 6, 23, 0.55);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                z-index: 100004;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: opacity 0.15s ease-out;
                user-select: none;
                pointer-events: none;
            }
            .subway-countdown-overlay.fade-out {
                opacity: 0;
            }
            .cd-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
            }
            .countdown-num {
                font-size: 76px;
                font-weight: 800;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #ffffff;
                line-height: 1;
                margin: 0;
                letter-spacing: -1.5px;
                text-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
            }
            .countdown-num.pop {
                animation: cdSubtlePop 0.22s ease-out;
            }
            .countdown-num.go {
                font-size: 58px;
                font-weight: 800;
                color: #10b981;
                letter-spacing: 2px;
                text-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
                animation: cdSubtlePop 0.2s ease-out;
            }
            @keyframes cdSubtlePop {
                0% { transform: scale(1.18); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
            }
            .countdown-sub {
                margin-top: 14px;
                padding: 4px 16px;
                border-radius: 9999px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #cbd5e1;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 1.2px;
                text-transform: uppercase;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            /* Map Filter Grading */
            body[data-map-theme="tokyo"] canvas { filter: contrast(1.18) hue-rotate(25deg) saturate(1.35) !important; }
            body[data-map-theme="rio"] canvas { filter: brightness(1.08) saturate(1.4) hue-rotate(-15deg) !important; }
            body[data-map-theme="hawaii"] canvas { filter: saturate(1.45) sepia(0.22) hue-rotate(-25deg) brightness(1.05) !important; }
            body[data-map-theme="paris"] canvas { filter: hue-rotate(275deg) saturate(1.15) brightness(1.03) !important; }
            body[data-map-theme="cairo"] canvas { filter: sepia(0.45) saturate(1.35) contrast(1.05) brightness(1.06) !important; }
            body[data-map-theme="las_vegas"] canvas { filter: none !important; }

            
            /* Stopwatch Run Timer (Top Center HUD) */
            .subway-top-timer-wrap {
                position: fixed;
                top: 16px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                display: none;
                align-items: center;
                gap: 8px;
                padding: 6px 16px;
                background: rgba(15, 23, 42, 0.82);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 20px;
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
                user-select: none;
                pointer-events: none;
            }

            /* Red Coin Shatter Effect on Dash Boost */
            .subway-shatter-burst {
                position: fixed;
                transform: translate(-50%, -50%);
                width: 60px;
                height: 60px;
                pointer-events: none;
                z-index: 99996;
            }
            .shatter-flash {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 70px;
                height: 70px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(255, 60, 60, 0.95) 0%, rgba(239, 68, 68, 0.4) 50%, rgba(255, 0, 0, 0) 75%);
                animation: shatterFlashAnim 0.25s ease-out forwards;
            }
            .shatter-ring {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 22px;
                height: 22px;
                border-radius: 50%;
                border: 3px solid #ff3344;
                box-shadow: 0 0 14px #ff2233;
                animation: shatterRingAnim 0.32s ease-out forwards;
            }
            .shatter-shard {
                position: absolute;
                top: 50%; left: 50%;
                width: 9px;
                height: 9px;
                background: linear-gradient(135deg, #ff4d4d, #b91c1c);
                border: 1px solid #ffffff;
                border-radius: 2px;
                box-shadow: 0 0 8px rgba(255, 50, 50, 0.8);
            }
            .shatter-shard.s1 { animation: shardFly1 0.35s cubic-bezier(0.1, 0.8, 0.3, 1) forwards; }
            .shatter-shard.s2 { animation: shardFly2 0.35s cubic-bezier(0.1, 0.8, 0.3, 1) forwards; }
            .shatter-shard.s3 { animation: shardFly3 0.35s cubic-bezier(0.1, 0.8, 0.3, 1) forwards; }
            .shatter-shard.s4 { animation: shardFly4 0.35s cubic-bezier(0.1, 0.8, 0.3, 1) forwards; }
            .shatter-shard.s5 { animation: shardFly5 0.35s cubic-bezier(0.1, 0.8, 0.3, 1) forwards; }
            .shatter-shard.s6 { animation: shardFly6 0.35s cubic-bezier(0.1, 0.8, 0.3, 1) forwards; }

            @keyframes shatterFlashAnim {
                0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
            }
            @keyframes shatterRingAnim {
                0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; }
            }
            @keyframes shardFly1 { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-42px, -36px) rotate(140deg) scale(0.2); opacity: 0; } }
            @keyframes shardFly2 { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(45px, -32px) rotate(-160deg) scale(0.2); opacity: 0; } }
            @keyframes shardFly3 { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50px, 16px) rotate(220deg) scale(0.2); opacity: 0; } }
            @keyframes shardFly4 { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(48px, 20px) rotate(-240deg) scale(0.2); opacity: 0; } }
            @keyframes shardFly5 { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-14px, -55px) rotate(80deg) scale(0.2); opacity: 0; } }
            @keyframes shardFly6 { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(18px, 45px) rotate(-110deg) scale(0.2); opacity: 0; } }
            .subway-top-timer-wrap .timer-icon {
                font-size: 14px;
            }
            .subway-top-timer-wrap .timer-value {
                font-size: 16px;
                font-weight: 800;
                letter-spacing: 0.5px;
                font-family: monospace;
                color: #f8fafc;
            }
            .subway-top-timer-wrap .timer-badge {
                font-size: 10px;
                font-weight: 800;
                padding: 2px 8px;
                border-radius: 10px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }
            .badge-nocoin {
                background: rgba(244, 63, 94, 0.18);
                border: 1px solid rgba(244, 63, 94, 0.4);
                color: #fb7185;
            }
            .badge-normal {
                background: rgba(250, 204, 21, 0.15);
                border: 1px solid rgba(250, 204, 21, 0.35);
                color: #facc15;
            }

            /* Direct Online Mode Button (Bottom-Left) */
            body.sw-in-run #btn-subway-online-lobby { display: none !important; }
            .btn-subway-online-lobby {
                position: fixed;
                top: max(14px, env(safe-area-inset-top, 14px));
                left: 58px;
                bottom: auto;
                z-index: 99998;
                height: 36px;
                padding: 0 14px 0 10px;
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                color: #e2e8f0;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 18px;
                cursor: pointer;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                font-weight: 700;
                font-size: 11px;
                letter-spacing: 0.8px;
                text-transform: uppercase;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                user-select: none;
                -webkit-user-select: none;
            }
            .btn-subway-online-lobby:hover {
                background: rgba(30, 41, 59, 0.95);
                border-color: rgba(56, 189, 248, 0.5);
                color: #fff;
                box-shadow: 0 8px 24px rgba(56, 189, 248, 0.25);
                transform: translateY(-1px);
            }
            .status-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 8px #10b981;
                position: relative;
            }
            .status-dot::after {
                content: '';
                position: absolute;
                top: -2px; left: -2px; right: -2px; bottom: -2px;
                border-radius: 50%;
                border: 1px solid #10b981;
                animation: pingRing 2s cubic-bezier(0, 0, 0.2, 1) infinite;
            }
            @keyframes pingRing {
                0% { transform: scale(0.9); opacity: 0.8; }
                80%, 100% { transform: scale(2.2); opacity: 0; }
            }

            body.sw-in-run #btn-subway-unified-menu { display: none !important; }
            .btn-subway-unified-menu {
                position: fixed;
                top: max(14px, env(safe-area-inset-top, 14px));
                left: 14px;
                bottom: auto;
                z-index: 99998;
                width: 36px;
                height: 36px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                color: #94a3b8;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 18px;
                cursor: pointer;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .btn-subway-unified-menu:hover {
                background: rgba(30, 41, 59, 0.95);
                border-color: rgba(255, 255, 255, 0.25);
                color: #fff;
                transform: translateY(-1px);
            }
            .btn-subway-unified-menu svg {
                width: 17px;
                height: 17px;
            }

            /* Modal Backdrop & Structure */
            .subway-modal-backdrop {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(2, 6, 23, 0.82);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .subway-modal-box {
                background: #090d16;
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 14px;
                box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 1px 1px rgba(255, 255, 255, 0.05);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                max-width: 90vw;
                max-height: 88vh;
            }
            .unified-box { width: 760px; }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 20px;
                background: rgba(255, 255, 255, 0.02);
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }
            .modal-header-branding {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .modal-brand-title {
                font-size: 13px;
                font-weight: 800;
                letter-spacing: 1.2px;
                color: #f8fafc;
            }
            .modal-brand-tag {
                font-size: 9px;
                font-weight: 800;
                letter-spacing: 1px;
                padding: 2px 6px;
                border-radius: 4px;
                background: rgba(56, 189, 248, 0.12);
                color: #38bdf8;
                border: 1px solid rgba(56, 189, 248, 0.25);
            }
            .btn-modal-close {
                background: none;
                border: none;
                color: #64748b;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 6px;
                transition: all 0.2s;
            }
            .btn-modal-close:hover { color: #fff; background: rgba(255,255,255,0.06); }

            /* Unified Tabs */
            .unified-tabs {
                display: flex;
                background: rgba(0, 0, 0, 0.35);
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                padding: 0 10px;
            }
            .tab-btn {
                padding: 12px 18px;
                background: none;
                border: none;
                color: #64748b;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.8px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
                margin-bottom: -1px;
            }
            .tab-btn:hover { color: #cbd5e1; }
            .tab-btn.active {
                color: #f8fafc;
                border-bottom-color: #38bdf8;
            }
            .tab-pane {
                display: none;
                padding: 14px 18px;
                overflow-x: hidden;
                overflow-y: auto;
            }
            .tab-pane.active { display: block; }

            /* Modes Tab */
            .mod-card {
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 10px;
                padding: 14px 18px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                transition: border-color 0.2s;
            }
            .mod-card:hover {
                border-color: rgba(255, 255, 255, 0.12);
            }
            .mod-info {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .mod-title {
                font-size: 13px;
                font-weight: 700;
                color: #f1f5f9;
                letter-spacing: 0.3px;
            }
            .mod-desc {
                font-size: 11px;
                color: #64748b;
                line-height: 1.4;
            }
            .btn-clean-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 14px;
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.04);
                color: #94a3b8;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.8px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .btn-clean-toggle .toggle-indicator {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #64748b;
                transition: all 0.2s;
            }
            .btn-clean-toggle.toggle-active {
                background: rgba(16, 185, 129, 0.12);
                border-color: rgba(16, 185, 129, 0.4);
                color: #34d399;
            }
            .btn-clean-toggle.toggle-active .toggle-indicator {
                background: #10b981;
                box-shadow: 0 0 6px #10b981;
            }
            .btn-clean-toggle.toggle-active-danger {
                background: rgba(244, 63, 94, 0.12);
                border-color: rgba(244, 63, 94, 0.4);
                color: #fb7185;
            }
            .btn-clean-toggle.toggle-active-danger .toggle-indicator {
                background: #f43f5e;
                box-shadow: 0 0 6px #f43f5e;
            }

            /* Modern Elimination Hub Header & Room Connect */
            .lobby-header-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                background: rgba(15, 23, 42, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 8px 14px;
                margin-bottom: 12px;
            }
            .lobby-room-badge {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .live-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 8px #10b981;
            }
            .room-lbl {
                color: #64748b;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.5px;
            }
            .room-code-tag {
                background: rgba(56, 189, 248, 0.1);
                border: 1px solid rgba(56, 189, 248, 0.3);
                border-radius: 6px;
                padding: 3px 8px;
                color: #38bdf8;
                font-weight: 800;
                font-family: monospace;
                letter-spacing: 1px;
                font-size: 12px;
            }
            .btn-copy-code {
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #cbd5e1;
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
            }
            .btn-copy-code:hover {
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
            }

            .lobby-user-profile {
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 10px;
                padding: 4px 10px;
            }
            .user-avatar-wrap img {
                width: 34px;
                height: 34px;
                border-radius: 50%;
                border: 2px solid #38bdf8;
                object-fit: cover;
                display: block;
            }
            .user-meta-wrap {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            #input-my-nick {
                background: transparent;
                border: none;
                border-bottom: 1px dashed rgba(255, 255, 255, 0.3);
                color: #f8fafc;
                font-size: 12px;
                font-weight: 800;
                padding: 1px 4px;
                width: 105px;
                outline: none;
                transition: border-color 0.2s;
            }
            #input-my-nick:focus {
                border-bottom-color: #38bdf8;
            }
            .avatar-dots-bar {
                display: flex;
                gap: 5px;
            }
            .avatar-dot-chip {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                opacity: 0.5;
                cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: all 0.15s;
            }
            .avatar-dot-chip:hover, .avatar-dot-chip.active {
                opacity: 1;
                border-color: #38bdf8;
                transform: scale(1.15);
                box-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
            }

            .lobby-join-box {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .lobby-join-box input {
                background: rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 6px;
                padding: 5px 8px;
                color: #fff;
                font-size: 11px;
                width: 95px;
                outline: none;
            }
            .lobby-join-box input:focus {
                border-color: #38bdf8;
            }
            .btn-join-room {
                background: #0284c7;
                color: #fff;
                border: none;
                border-radius: 6px;
                padding: 5px 10px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.2s;
            }
            .btn-join-room:hover { background: #0369a1; }

            /* Grid Layout */
            .lobby-grid {
                display: flex;
                gap: 14px;
            }
            .lobby-column {
                flex: 1;
                background: rgba(15, 23, 42, 0.55);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 12px;
                padding: 12px 14px;
                display: flex;
                flex-direction: column;
            }
            .col-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            .col-title-wrap h3 {
                margin: 0;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.5px;
                color: #f1f5f9;
            }
            .party-hint {
                display: block;
                font-size: 10px;
                color: #94a3b8;
                margin-top: 2px;
            }
            .btn-add-bot, .btn-refresh-online {
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #cbd5e1;
                border-radius: 6px;
                padding: 3px 9px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
            }
            .btn-add-bot:hover, .btn-refresh-online:hover {
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
            }

            /* Party Slots */
            .party-slots-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 14px;
                flex: 1;
            }
            .party-slot {
                height: 44px;
                border-radius: 8px;
                padding: 0 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: all 0.2s;
            }
            .slot-filled {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .slot-ready {
                border-color: rgba(16, 185, 129, 0.5);
                background: rgba(16, 185, 129, 0.05);
            }
            .slot-waiting {
                border-color: rgba(245, 158, 11, 0.35);
            }
            .slot-me {
                box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.25);
            }
            .slot-empty {
                border: 1px dashed rgba(255, 255, 255, 0.1);
                background: transparent;
                justify-content: space-between;
                color: #64748b;
                font-size: 11px;
            }
            .slot-idx {
                font-size: 11px;
                font-weight: 800;
                color: #475569;
                width: 14px;
                text-align: center;
            }
            .slot-avatar {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background-size: cover;
                background-position: center;
                position: relative;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .crown-icon {
                position: absolute;
                top: -8px;
                left: -6px;
                font-size: 13px;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
            }
            .slot-details {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .slot-nick-row {
                display: flex;
                align-items: center;
            }
            .slot-nick {
                font-size: 12px;
                font-weight: 700;
                color: #e2e8f0;
            }
            .tag-you {
                background: #0284c7;
                color: #fff;
                font-size: 9px;
                font-weight: 800;
                padding: 1px 5px;
                border-radius: 4px;
                margin-left: 6px;
                letter-spacing: 0.5px;
            }
            .tag-bot {
                background: #7c3aed;
                color: #fff;
                font-size: 9px;
                font-weight: 800;
                padding: 1px 5px;
                border-radius: 4px;
                margin-left: 6px;
                letter-spacing: 0.5px;
            }
            .slot-right {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .slot-status-pill {
                font-size: 10px;
                font-weight: 800;
                padding: 2px 8px;
                border-radius: 12px;
                letter-spacing: 0.5px;
            }
            .slot-status-pill.st-ready {
                background: rgba(16, 185, 129, 0.15);
                color: #34d399;
                border: 1px solid rgba(16, 185, 129, 0.3);
            }
            .slot-status-pill.st-waiting {
                background: rgba(245, 158, 11, 0.15);
                color: #fbbf24;
                border: 1px solid rgba(245, 158, 11, 0.3);
            }
            .btn-kick {
                background: none;
                border: none;
                color: #f43f5e;
                cursor: pointer;
                font-size: 13px;
                padding: 2px 5px;
                opacity: 0.7;
            }
            .btn-kick:hover { opacity: 1; }
            .btn-slot-add-bot {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #94a3b8;
                border-radius: 5px;
                padding: 3px 8px;
                font-size: 10px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
            }
            .btn-slot-add-bot:hover {
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
            }

            /* Bottom Actions */
            .party-bottom-actions {
                display: flex;
                gap: 8px;
                align-items: center;
                margin-top: auto;
            }
            .btn-ready {
                flex: 1.1;
                height: 38px;
                border-radius: 8px;
                border: none;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.5px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .btn-ready.ready-on {
                background: #10b981;
                color: #fff;
                box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
            }
            .btn-ready.ready-off {
                background: #334155;
                color: #cbd5e1;
            }
            .btn-ready.ready-off:hover {
                background: #475569;
            }
            .btn-start-match {
                flex: 1.4;
                height: 38px;
                border-radius: 8px;
                border: none;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.5px;
                cursor: not-allowed;
                background: #1e293b;
                color: #64748b;
                transition: all 0.2s;
            }
            .btn-start-match.can-start {
                cursor: pointer;
                background: linear-gradient(135deg, #f43f5e, #e11d48);
                color: #fff;
                box-shadow: 0 0 14px rgba(244, 63, 94, 0.4);
            }
            .btn-start-match.can-start:hover {
                filter: brightness(1.1);
            }
            .btn-leave-room {
                height: 38px;
                padding: 0 12px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.05);
                color: #94a3b8;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
            }
            .btn-leave-room:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }

            /* Online Players List */
            .online-players-list {
                max-height: 195px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
                flex: 1;
            }
            .player-card {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 6px 10px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                transition: all 0.2s;
            }
            .player-card.in-party {
                opacity: 0.6;
            }
            .card-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                object-fit: cover;
                border: 1px solid rgba(255, 255, 255, 0.15);
            }
            .card-info {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .card-nick {
                font-size: 12px;
                font-weight: 700;
                color: #e2e8f0;
            }
            .card-state-text {
                font-size: 9px;
                color: #64748b;
            }
            .btn-invite {
                background: #0284c7;
                border: none;
                color: #fff;
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.2s;
            }
            .btn-invite:hover {
                background: #0369a1;
            }
            .btn-invite[disabled] {
                background: rgba(255, 255, 255, 0.05);
                color: #64748b;
                cursor: default;
            }

            /* Records Tab */
            .records-filter-bar { display: flex; gap: 8px; margin-bottom: 12px; }
            .btn-filter-record {
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 6px; padding: 6px 12px; color: #a1b0be; font-size: 11px; cursor: pointer;
            }
            .btn-filter-record.active { background: #ff4b2b; color: #fff; border-color: #ff4b2b; font-weight: 700; }
            .btn-clear-records { margin-left: auto; background: none; border: none; color: #e57373; font-size: 11px; cursor: pointer; }
            .records-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .records-table th { text-align: left; padding: 8px; color: #8fa0b0; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .records-table td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
            .b-nocoin { background: #e53935; color: #fff; }
            .b-normal { background: #fbc02d; color: #000; }
            .td-time { font-weight: 700; font-family: monospace; }
            .td-date { color: #8fa0b0; font-size: 11px; }

            /* HUD Alerts, Death Flash & Dash Burst */
            .subway-death-flash {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(229, 57, 53, 0.45); z-index: 999999;
                pointer-events: none; animation: flashFade 0.4s ease forwards;
            }
            .subway-dash-burst {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(circle, rgba(0,229,255,0) 40%, rgba(0,229,255,0.45) 100%);
                box-shadow: inset 0 0 80px rgba(0,229,255,0.8);
                z-index: 99996;
                pointer-events: none;
                animation: dashBurstAnim 0.45s ease-out forwards;
            }
            .subway-boost-time-pop {
                position: fixed;
                top: 42%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 32px;
                font-weight: 900;
                color: #00e5ff;
                text-shadow: 0 0 16px rgba(0, 229, 255, 0.9), 0 4px 12px rgba(0,0,0,0.8);
                letter-spacing: 1px;
                pointer-events: none;
                z-index: 99999;
                animation: boostPopAnim 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes boostPopAnim {
                0% { opacity: 0; transform: translate(-50%, 0) scale(0.6); }
                30% { opacity: 1; transform: translate(-50%, -24px) scale(1.15); }
                100% { opacity: 0; transform: translate(-50%, -55px) scale(1); }
            }

            .rec-player-cell { display: flex; align-items: center; gap: 8px; }
            .rec-avatar { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); }
            .rec-you-tag { background: #3b82f6; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; }
            .row-me { background: rgba(59, 130, 246, 0.12) !important; font-weight: 700; }
            .rank-1 { background: rgba(234, 179, 8, 0.12) !important; color: #fde047; }
            .rank-2 { background: rgba(148, 163, 184, 0.1) !important; color: #e2e8f0; }
            .rank-3 { background: rgba(217, 119, 6, 0.1) !important; color: #fdba74; }
            @keyframes dashBurstAnim {
                0% { opacity: 1; transform: scale(1.04); }
                100% { opacity: 0; transform: scale(1); }
            }
            @keyframes flashFade { 0% { opacity: 1; } 100% { opacity: 0; } }
            .subway-hud-alert {
                position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
                z-index: 100000; background: #e53935; color: #fff; padding: 10px 20px;
                border-radius: 20px; font-weight: 800; font-size: 13px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5); pointer-events: none;
            }

            /* Invite Popup */
            .subway-invite-popup {
                position: fixed; bottom: 20px; right: 20px; z-index: 100001;
                background: #152238; border: 1px solid #2979ff; border-radius: 12px;
                padding: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.6);
            }
            .invite-pop-box { display: flex; align-items: center; gap: 12px; }
            .invite-pop-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
            .invite-pop-text { font-size: 12px; color: #fff; }
            .invite-pop-actions { display: flex; gap: 6px; margin-left: 10px; }
            .btn-invite-accept { background: #00c853; border: none; color: #fff; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-weight: 700; }
            .btn-invite-reject { background: #37474f; border: none; color: #fff; border-radius: 6px; padding: 6px 12px; cursor: pointer; }

            /* Live Placement HUD & Ghost Runners */
            .subway-live-rank {
                position: fixed; top: 68px; right: 16px; z-index: 99998;
                background: rgba(10, 16, 30, 0.85); backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.15); border-radius: 10px;
                padding: 10px 14px; color: #fff; font-size: 11px; min-width: 170px;
                pointer-events: none; user-select: none;
            }
            .rank-header { font-weight: 800; margin-bottom: 6px; color: #8fa0b0; }
            .rank-item { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
            .rk-alive { color: #fff; }
            .rk-dead { color: #78909c; text-decoration: line-through; }
            .rk-avatar { width: 18px; height: 18px; border-radius: 50%; }
            .rk-nick { flex: 1; font-weight: 700; }
            .rk-st { font-size: 9px; font-weight: 800; }

            .subway-ghost-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 99997; }
            .ghost-runner-wrap {
                position: absolute;
                transform: translate(-50%, -100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                transition: left 0.08s linear, top 0.08s linear, transform 0.08s linear;
            }
            .ghost-tag {
                background: rgba(10, 20, 40, 0.78); backdrop-filter: blur(4px);
                border: 1px solid #00e5ff; border-radius: 14px; padding: 2px 8px;
                display: flex; align-items: center; gap: 4px; color: #fff; font-size: 10px; font-weight: 700;
                margin-bottom: 4px; white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0, 229, 255, 0.35);
            }
            .ghost-figure {
                width: 34px;
                height: 54px;
                border-radius: 14px 14px 8px 8px;
                background: linear-gradient(180deg, rgba(0, 229, 255, 0.45) 0%, rgba(41, 121, 255, 0.25) 100%);
                border: 1.5px solid rgba(0, 229, 255, 0.65);
                box-shadow: 0 0 14px rgba(0, 229, 255, 0.45);
                opacity: 0.55;
                animation: ghostBob 0.35s infinite alternate ease-in-out;
            }
            @keyframes ghostBob {
                0% { transform: translateY(0px) scaleY(1); }
                100% { transform: translateY(-5px) scaleY(0.95); }
            }
            .gt-avatar { width: 14px; height: 14px; border-radius: 50%; }

            /* User Avatar URL input and chip */
            .avatar-edit-icon {
                position: absolute;
                bottom: -2px;
                right: -2px;
                background: #0284c7;
                color: #fff;
                font-size: 9px;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid #0f172a;
            }
            .user-avatar-wrap {
                position: relative;
                cursor: pointer;
            }
            .user-avatar-wrap:hover img {
                border-color: #38bdf8;
                box-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
            }
            .user-fields-row {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            #input-my-avatar-url {
                background: rgba(0, 0, 0, 0.35);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 6px;
                color: #cbd5e1;
                font-size: 10px;
                padding: 2px 6px;
                width: 90px;
                outline: none;
                transition: all 0.2s;
            }
            #input-my-avatar-url:focus {
                border-color: #38bdf8;
                width: 130px;
                background: rgba(0, 0, 0, 0.7);
            }
            .btn-avatar-url-chip {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.18);
                color: #94a3b8;
                border-radius: 10px;
                padding: 1px 6px;
                font-size: 9px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.15s;
            }
            .btn-avatar-url-chip:hover {
                background: rgba(56, 189, 248, 0.2);
                border-color: #38bdf8;
                color: #fff;
            }

            /* Clean Waiting Overlay (When player dies in online tournament) */
            .subway-wait-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(2, 6, 23, 0.75);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: waitFadeIn 0.3s ease;
            }
            @keyframes waitFadeIn {
                from { opacity: 0; transform: scale(0.96); }
                to { opacity: 1; transform: scale(1); }
            }
            .wait-card {
                background: #0b1120;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 14px;
                padding: 20px 24px;
                width: 440px;
                max-width: 90vw;
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.05);
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .wait-card-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding-bottom: 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }
            .wait-pulse-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #f43f5e;
                box-shadow: 0 0 10px #f43f5e;
                animation: waitPulse 1.5s infinite;
            }
            @keyframes waitPulse {
                0% { transform: scale(0.9); opacity: 0.8; }
                50% { transform: scale(1.3); opacity: 1; }
                100% { transform: scale(0.9); opacity: 0.8; }
            }
            .wait-header-title {
                font-size: 13px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #f8fafc;
            }
            .wait-round-badge {
                margin-left: auto;
                background: rgba(56, 189, 248, 0.1);
                border: 1px solid rgba(56, 189, 248, 0.3);
                color: #38bdf8;
                border-radius: 6px;
                padding: 2px 8px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.5px;
            }
            .wait-stats-row {
                display: flex;
                gap: 12px;
            }
            .wait-stat-box {
                flex: 1;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 8px;
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .wait-stat-lbl {
                font-size: 10px;
                color: #64748b;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .wait-stat-val {
                font-size: 16px;
                font-weight: 900;
                font-family: monospace;
            }
            .val-cyan { color: #38bdf8; }
            .val-gold { color: #facc15; }

            .wait-runners-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .wait-section-lbl {
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.8px;
                color: #94a3b8;
            }
            .wait-runners-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
                max-height: 120px;
                overflow-y: auto;
            }
            .wait-live-runner-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 10px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 6px;
            }
            .wait-runner-avatar {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                object-fit: cover;
            }
            .wait-runner-name {
                font-size: 11px;
                font-weight: 700;
                color: #e2e8f0;
                flex: 1;
            }
            .wait-runner-time {
                font-size: 11px;
                font-family: monospace;
                font-weight: 800;
                color: #38bdf8;
            }
            .wait-runner-tag {
                background: rgba(16, 185, 129, 0.15);
                border: 1px solid rgba(16, 185, 129, 0.3);
                color: #34d399;
                font-size: 9px;
                font-weight: 800;
                padding: 1px 5px;
                border-radius: 4px;
            }
            .wait-no-alive {
                font-size: 11px;
                color: #94a3b8;
                padding: 6px 0;
                text-align: center;
            }

            .wait-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-top: 4px;
            }
            .btn-wait-spectate, .btn-wait-practice {
                display: flex;
                align-items: center;
                gap: 10px;
                border-radius: 10px;
                padding: 10px 14px;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                color: #fff;
                text-align: left;
            }
            .btn-wait-spectate {
                background: linear-gradient(135deg, rgba(225, 29, 72, 0.2), rgba(147, 51, 234, 0.2));
                border: 1px solid rgba(244, 63, 94, 0.4);
            }
            .btn-wait-spectate:hover {
                background: linear-gradient(135deg, rgba(225, 29, 72, 0.35), rgba(147, 51, 234, 0.35));
                border-color: #f43f5e;
                transform: translateY(-1px);
                box-shadow: 0 8px 24px rgba(244, 63, 94, 0.3);
            }
            .btn-wait-practice {
                background: linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(16, 185, 129, 0.2));
                border: 1px solid rgba(56, 189, 248, 0.4);
            }
            .btn-wait-practice:hover {
                background: linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(16, 185, 129, 0.35));
                border-color: #38bdf8;
                transform: translateY(-1px);
                box-shadow: 0 8px 24px rgba(56, 189, 248, 0.3);
            }
            .wait-act-icon { font-size: 18px; flex-shrink: 0; }
            .wait-act-text { display: flex; flex-direction: column; gap: 2px; }
            .wait-act-main { font-size: 11px; font-weight: 800; letter-spacing: 0.6px; color: #f8fafc; }
            .wait-act-sub { font-size: 9px; color: #94a3b8; line-height: 1.2; }

            /* Esports Spectator HUD */
            .subway-spectator-hud {
                position: fixed;
                top: 16px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: waitFadeIn 0.3s ease;
            }
            .spec-bar-card {
                display: flex;
                align-items: center;
                gap: 14px;
                background: rgba(15, 23, 42, 0.88);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                border: 1px solid rgba(244, 63, 94, 0.4);
                border-radius: 9999px;
                padding: 6px 16px;
                color: #fff;
                box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
            }
            .spec-left-meta {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .spec-pulse-live {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #f43f5e;
                box-shadow: 0 0 10px #f43f5e;
                animation: blink 1s infinite;
            }
            .spec-live-tag {
                color: #f43f5e;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 1px;
            }
            .spec-divider { color: rgba(255, 255, 255, 0.2); font-size: 11px; }
            .spec-target-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 1.5px solid #38bdf8;
                object-fit: cover;
            }
            .spec-name-box {
                display: flex;
                flex-direction: column;
                gap: 1px;
            }
            .spec-target-name {
                font-size: 11px;
                font-weight: 800;
                color: #f1f5f9;
                max-width: 90px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .spec-target-status {
                font-size: 8px;
                font-weight: 700;
            }
            .status-alive { color: #10b981; }
            .status-dead { color: #ef4444; }
            .spec-center-stat {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 0 8px;
                border-left: 1px solid rgba(255, 255, 255, 0.1);
                border-right: 1px solid rgba(255, 255, 255, 0.1);
            }
            .spec-stat-lbl {
                font-size: 8px;
                color: #94a3b8;
                letter-spacing: 0.5px;
            }
            .spec-stat-time {
                font-size: 13px;
                font-weight: 900;
                font-family: monospace;
                color: #38bdf8;
            }
            .spec-right-controls {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .btn-spec-nav {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #cbd5e1;
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 10px;
                cursor: pointer;
                transition: all 0.15s;
            }
            .btn-spec-nav:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }
            .btn-spec-practice {
                background: rgba(2, 132, 199, 0.25);
                border: 1px solid rgba(56, 189, 248, 0.4);
                color: #38bdf8;
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 10px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.15s;
            }
            .btn-spec-practice:hover { background: rgba(2, 132, 199, 0.45); color: #fff; }
            .btn-spec-exit {
                background: rgba(255, 255, 255, 0.08);
                border: none;
                color: #94a3b8;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.15s;
            }
            .btn-spec-exit:hover { background: rgba(239, 68, 68, 0.3); color: #f87171; }

            /* Practice HUD during active training */
            .subway-practice-hud {
                position: fixed;
                top: 18px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: waitFadeIn 0.3s ease;
            }
            .practice-pill {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(56, 189, 248, 0.35);
                border-radius: 20px;
                padding: 6px 14px;
                color: #e2e8f0;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
                font-size: 11px;
                font-weight: 700;
            }
            .practice-pulse {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #38bdf8;
                box-shadow: 0 0 8px #38bdf8;
            }
            .practice-lbl {
                color: #38bdf8;
                font-weight: 800;
                letter-spacing: 0.8px;
            }
            .practice-sep { color: #64748b; }
            .practice-msg { color: #cbd5e1; font-weight: 500; }
            .btn-quit-practice {
                background: rgba(255, 255, 255, 0.08);
                border: none;
                color: #94a3b8;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                cursor: pointer;
                margin-left: 4px;
                transition: all 0.2s;
            }
            .btn-quit-practice:hover {
                background: rgba(244, 63, 94, 0.2);
                color: #f43f5e;
            }



            .subway-winner-banner {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.85); z-index: 100005;
                display: flex; align-items: center; justify-content: center;
            }
            .winner-card {
                background: #101c33; border: 2px solid #ffd700; border-radius: 16px;
                padding: 30px; text-align: center; color: #fff; box-shadow: 0 0 40px rgba(255,215,0,0.4);
            }
            .winner-trophy { font-size: 50px; margin-bottom: 10px; }
            .winner-avatar { width: 70px; height: 70px; border-radius: 50%; border: 3px solid #ffd700; margin: 10px 0; }
            .btn-winner-close {
                margin-top: 16px; background: #ffd700; border: none; color: #000;
                font-weight: 800; border-radius: 8px; padding: 10px 20px; cursor: pointer;
            }

            /* Ultra-Sleek Esports Countdown */
            .subway-countdown-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(circle at center, rgba(15, 23, 42, 0.75) 0%, rgba(2, 6, 23, 0.92) 100%);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 100004;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: opacity 0.2s ease-out;
            }
            .subway-countdown-overlay.fade-out {
                opacity: 0;
                pointer-events: none;
            }
            .cd-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
            }
            .cd-circle-glow {
                position: absolute;
                width: 180px;
                height: 180px;
                border-radius: 50%;
                border: 1.5px solid rgba(56, 189, 248, 0.25);
                box-shadow: 0 0 50px rgba(56, 189, 248, 0.25), inset 0 0 30px rgba(56, 189, 248, 0.12);
                animation: cdPulse 1s infinite alternate ease-in-out;
            }
            @keyframes cdPulse {
                0% { transform: scale(0.94); opacity: 0.6; }
                100% { transform: scale(1.06); opacity: 1; }
            }
            .countdown-num {
                font-size: 96px;
                font-weight: 900;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(180deg, #ffffff 40%, #38bdf8 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 4px 20px rgba(56, 189, 248, 0.6));
                line-height: 1;
                margin: 0;
                z-index: 1;
            }
            .countdown-num.pop {
                animation: cdPop 0.85s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .countdown-num.go {
                font-size: 80px;
                background: linear-gradient(180deg, #ffffff 30%, #10b981 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 4px 24px rgba(16, 185, 129, 0.7));
                animation: cdGo 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes cdPop {
                0% { transform: scale(1.4); opacity: 0; filter: blur(4px); }
                50% { transform: scale(0.96); opacity: 1; filter: blur(0); }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes cdGo {
                0% { transform: scale(0.7); opacity: 0; }
                60% { transform: scale(1.15); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
            .countdown-sub {
                margin-top: 20px;
                padding: 5px 16px;
                border-radius: 9999px;
                background: rgba(56, 189, 248, 0.1);
                border: 1px solid rgba(56, 189, 248, 0.3);
                color: #38bdf8;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 2px;
                text-transform: uppercase;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                z-index: 1;
            }

            
            /* Minimalist Live Race Standings (Top-Right) */
            .subway-tl-wrap {
                position: fixed;
                top: 58px;
                right: 14px;
                z-index: 99998;
                width: 215px;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: waitFadeIn 0.3s ease;
            }
            .tl-panel {
                background: #0b1120 !important;
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                padding: 8px 10px;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .tl-head-row {
                display: flex;
                align-items: center;
                gap: 6px;
                padding-bottom: 5px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }
            .tl-pulse-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 6px #10b981;
            }
            .tl-head {
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.8px;
                color: #e2e8f0;
                text-transform: uppercase;
            }
            .tl-runners-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .tl-runner-item {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 6px;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 6px;
                transition: all 0.2s ease;
            }
            .tl-runner-item.runner-me {
                border-color: rgba(56, 189, 248, 0.4);
                background: rgba(56, 189, 248, 0.08);
            }
            .tl-runner-item.runner-dead {
                opacity: 0.55;
            }
            .tl-pos {
                font-size: 10px;
                font-weight: 800;
                color: #94a3b8;
                width: 12px;
                text-align: center;
            }
            .tl-pos.pos-gold { color: #facc15; }
            .tl-av {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                object-fit: cover;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .tl-name {
                font-size: 11px;
                font-weight: 700;
                color: #f1f5f9;
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .tl-you {
                font-size: 8px;
                font-weight: 800;
                background: #0284c7;
                color: #fff;
                padding: 1px 3px;
                border-radius: 3px;
                margin-left: 4px;
            }
            .tl-score {
                font-size: 10px;
                font-family: monospace;
                font-weight: 800;
            }
            .score-alive { color: #38bdf8; }
            .score-dead { color: #f43f5e; }

            /* Championship Interlude & Final Results Hub */
            .subway-interlude {
                position: fixed;
                inset: 0;
                z-index: 100006;
                background: rgba(2, 6, 23, 0.85);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: waitFadeIn 0.3s ease;
            }
            .il-card {
                background: #0b1120 !important;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 16px;
                padding: 24px;
                width: 480px;
                max-width: 92vw;
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.05);
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .il-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-bottom: 12px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }
            .il-title-wrap {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .il-title {
                font-size: 14px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #f8fafc;
            }
            .il-subtitle {
                font-size: 11px;
                color: #64748b;
            }

            /* Winner Spotlight */
            .il-winner-spotlight {
                display: flex;
                align-items: center;
                gap: 16px;
                background: linear-gradient(135deg, rgba(250, 204, 21, 0.12), rgba(245, 158, 11, 0.04));
                border: 1px solid rgba(250, 204, 21, 0.35);
                border-radius: 12px;
                padding: 14px 18px;
            }
            .il-trophy-ring {
                position: relative;
                width: 52px;
                height: 52px;
            }
            .il-champ-avatar {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                object-fit: cover;
                border: 2px solid #facc15;
                box-shadow: 0 0 15px rgba(250, 204, 21, 0.4);
            }
            .il-crown {
                position: absolute;
                top: -10px;
                left: -6px;
                font-size: 18px;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
            }
            .il-champ-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .il-champ-label {
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 1px;
                color: #facc15;
            }
            .il-champ-name {
                font-size: 18px;
                font-weight: 900;
                color: #fff;
            }
            .il-champ-score {
                font-size: 11px;
                font-family: monospace;
                font-weight: 700;
                color: #38bdf8;
            }

            /* Standings Table */
            .il-table-wrap {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .il-head {
                display: grid;
                grid-template-columns: 24px 24px 1fr 65px 75px 65px;
                align-items: center;
                gap: 8px;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0.5px;
                color: #64748b;
                padding: 4px 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }
            .il-rows {
                display: flex;
                flex-direction: column;
                gap: 4px;
                max-height: 180px;
                overflow-y: auto;
            }
            .il-row {
                display: grid;
                grid-template-columns: 24px 24px 1fr 65px 75px 65px;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid rgba(255, 255, 255, 0.04);
                border-radius: 8px;
                transition: all 0.2s;
            }
            .il-winner-row {
                border-color: rgba(250, 204, 21, 0.3);
                background: rgba(250, 204, 21, 0.05);
            }
            .il-me-row {
                border-color: rgba(56, 189, 248, 0.3);
                background: rgba(56, 189, 248, 0.06);
            }
            .il-pos {
                font-size: 11px;
                font-weight: 800;
                color: #64748b;
                text-align: center;
            }
            .il-pos.pos-1 { color: #facc15; }
            .il-av {
                width: 22px;
                height: 22px;
                border-radius: 50%;
                object-fit: cover;
            }
            .il-runner-col {
                display: flex;
                align-items: center;
                overflow: hidden;
            }
            .il-nick {
                font-size: 12px;
                font-weight: 700;
                color: #f1f5f9;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .il-r {
                font-size: 11px;
                font-family: monospace;
                color: #94a3b8;
                text-align: right;
            }
            .il-t {
                font-size: 12px;
                font-family: monospace;
                font-weight: 800;
                color: #38bdf8;
                text-align: right;
            }
            .il-status-col { text-align: right; }
            .il-badge {
                font-size: 9px;
                font-weight: 800;
                padding: 2px 6px;
                border-radius: 4px;
                letter-spacing: 0.5px;
            }
            .il-champ {
                background: rgba(250, 204, 21, 0.2);
                color: #facc15;
                border: 1px solid rgba(250, 204, 21, 0.4);
            }
            .il-silver {
                background: rgba(203, 213, 225, 0.15);
                color: #e2e8f0;
                border: 1px solid rgba(203, 213, 225, 0.3);
            }
            .il-sub {
                background: rgba(255, 255, 255, 0.05);
                color: #94a3b8;
            }

            /* Footer Actions */
            .il-footer-actions {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 10px;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
            }
            .il-countdown-text {
                font-size: 11px;
                color: #94a3b8;
            }
            .il-countdown-text strong {
                color: #38bdf8;
                font-family: monospace;
            }
            .btn-il-lobby {
                background: #0284c7;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 8px 16px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.8px;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
            }
            .btn-il-lobby:hover {
                background: #0369a1;
                transform: translateY(-1px);
                box-shadow: 0 6px 18px rgba(2, 132, 199, 0.45);
            }

            /* Floating Online Round Warning */
            .subway-online-notice {
                position: fixed;
                top: 48px;
                left: 50%;
                transform: translateX(-50%) translateY(-12px);
                background: rgba(15, 23, 42, 0.96);
                border: 1px solid rgba(239, 68, 68, 0.6);
                color: #fca5a5;
                padding: 7px 16px;
                border-radius: 9999px;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.5px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                z-index: 100005;
                opacity: 0;
                pointer-events: none;
                transition: all 0.22s ease-out;
            }
            .subway-online-notice.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            /* Responsive Mobile & Small-Screen Adaptation */
            @media (max-width: 768px) {
                * {
                    -webkit-tap-highlight-color: transparent !important;
                }
                .subway-modal-backdrop {
                    padding: 12px !important;
                    align-items: center !important;
                    justify-content: center !important;
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                    background: rgba(2, 6, 23, 0.92) !important;
                }
                .subway-modal-box, .unified-box {
                    width: 94vw !important;
                    max-width: 420px !important;
                    height: auto !important;
                    max-height: 84vh !important;
                    margin: auto !important;
                    border-radius: 16px !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                    display: flex !important;
                    flex-direction: column !important;
                    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.9) !important;
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                    background: #090e1a !important;
                }
                .modal-header {
                    padding: 12px 16px !important;
                    flex-shrink: 0 !important;
                    background: #0f172a !important;
                }
                .modal-brand-title {
                    font-size: 13px !important;
                }
                .btn-modal-close {
                    font-size: 20px !important;
                    padding: 4px 10px !important;
                }

                /* Tabs: Touch-Friendly Segmented Control */
                .unified-tabs {
                    display: flex !important;
                    gap: 6px !important;
                    padding: 8px 12px !important;
                    flex-shrink: 0 !important;
                    background: #0b1120 !important;
                }
                .tab-btn {
                    padding: 8px 6px !important;
                    font-size: 11px !important;
                    font-weight: 800 !important;
                    flex: 1 !important;
                    height: 38px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    text-align: center !important;
                    border-radius: 8px !important;
                    background: rgba(255, 255, 255, 0.05) !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    touch-action: manipulation !important;
                }
                .tab-btn.active {
                    background: rgba(56, 189, 248, 0.22) !important;
                    border-color: #38bdf8 !important;
                    color: #fff !important;
                }

                /* Scrollable Tab Pane */
                .tab-pane {
                    flex: 1 !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                    padding: 12px 14px 20px 14px !important;
                    box-sizing: border-box !important;
                }

                /* Buttons at Top-Left (Never overlap bottom Home / Back to start) */
                .btn-subway-unified-menu {
                    width: 38px !important;
                    height: 38px !important;
                    top: max(12px, env(safe-area-inset-top, 12px)) !important;
                    bottom: auto !important;
                    left: 12px !important;
                    border-radius: 19px !important;
                    z-index: 99998 !important;
                }
                .btn-subway-online-lobby {
                    height: 38px !important;
                    padding: 0 12px !important;
                    top: max(12px, env(safe-area-inset-top, 12px)) !important;
                    bottom: auto !important;
                    left: 56px !important;
                    font-size: 11px !important;
                    font-weight: 800 !important;
                    border-radius: 19px !important;
                    z-index: 99998 !important;
                }
                
                .subway-live-rank {
                    top: max(54px, env(safe-area-inset-top, 54px)) !important;
                    right: 8px !important;
                    min-width: 120px !important;
                    padding: 6px 10px !important;
                    font-size: 10px !important;
                    pointer-events: none !important;
                    user-select: none !important;
                }
                .subway-tl-wrap {
                    top: 155px !important;
                    right: 6px !important;
                    width: 125px !important;
                    pointer-events: none !important;
                }
                .tl-track {
                    height: 140px !important;
                    min-height: 110px !important;
                }
                .tl-nick {
                    max-width: 48px !important;
                    font-size: 9px !important;
                }
                .tl-pill {
                    font-size: 8px !important;
                    height: 18px !important;
                    right: 28px !important;
                    top: 5px !important;
                    padding: 0 5px !important;
                }
                .tl-dot {
                    width: 24px !important;
                    height: 24px !important;
                }
                .il-card {
                    padding: 10px 12px !important;
                }
                .countdown-num {
                    font-size: 64px !important;
                }
                .cd-circle-glow {
                    width: 140px !important;
                    height: 140px !important;
                }
                .countdown-sub {
                    font-size: 10px !important;
                    padding: 4px 12px !important;
                }
                .subway-invite-popup {
                    bottom: 12px !important;
                    right: 12px !important;
                    padding: 12px !important;
                    border-radius: 12px !important;
                }
            }

            @media (max-height: 520px) {
                .subway-modal-box, .unified-box {
                    max-height: 96vh !important;
                    padding: 6px 10px !important;
                }
                .modal-header {
                    padding: 2px 2px 4px 2px !important;
                    margin-bottom: 4px !important;
                }
                .unified-tabs {
                    margin-bottom: 6px !important;
                }
                .tab-btn {
                    padding: 4px 6px !important;
                    font-size: 9px !important;
                }
                .lobby-header-bar {
                    padding: 4px 8px !important;
                    margin-bottom: 6px !important;
                    gap: 6px !important;
                }
                .party-slot {
                    height: 36px !important;
                }
                .slot-avatar {
                    width: 24px !important;
                    height: 24px !important;
                }
                .party-actions-row button {
                    padding: 6px 4px !important;
                    min-height: 32px !important;
                }
                .online-col {
                    max-height: 160px !important;
                }
                .countdown-num { font-size: 54px !important; }
                .cd-circle-glow { width: 120px !important; height: 120px !important; }
            }
            /* Mode Switcher: 1v1 vs Torneio (Professional Esports Design) */
            .mp-mode-toggle-group {
                display: flex;
                gap: 6px;
                margin-bottom: 12px;
                background: #090d14;
                padding: 4px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .btn-mp-mode {
                flex: 1;
                padding: 10px 14px;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 8px;
                color: #7b8c9d;
                font-family: inherit;
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.8px;
                text-transform: uppercase;
                cursor: pointer;
                touch-action: manipulation;
                transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .btn-mp-mode:hover {
                color: #e2e8f0;
                background: rgba(255, 255, 255, 0.04);
            }
            .btn-mp-mode:active {
                transform: scale(0.97);
            }
            .btn-mp-mode.active {
                background: linear-gradient(135deg, #00d2ff, #0055ff);
                color: #ffffff;
                border-color: rgba(0, 210, 255, 0.6);
                box-shadow: 0 2px 12px rgba(0, 210, 255, 0.35);
            }

            /* Professional In-game Match HUD */
            .subway-coop-hud {
                position: fixed;
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99990;
                pointer-events: none;
                animation: coopHudDrop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes coopHudDrop {
                0% { opacity: 0; transform: translate(-50%, -15px); }
                100% { opacity: 1; transform: translate(-50%, 0); }
            }
            .coop-hud-pill {
                display: flex;
                align-items: center;
                gap: 12px;
                background: rgba(11, 16, 26, 0.92);
                backdrop-filter: blur(14px);
                border: 1px solid rgba(0, 229, 255, 0.4);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 229, 255, 0.2);
                padding: 6px 18px;
                border-radius: 999px;
            }
            .coop-hud-badge {
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.8px;
                color: #00e5ff;
                text-transform: uppercase;
            }
            .coop-hud-stat {
                font-size: 13px;
                font-weight: 800;
                color: #ffffff;
                font-family: monospace;
                letter-spacing: 0.5px;
            }

            /* Clean Overhead Nametags */
            .subway-coop-tags-overlay {
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 99980;
                overflow: hidden;
            }
            .coop-teammate-nametag {
                position: absolute;
                top: 0;
                left: 0;
                display: none;
                flex-direction: column;
                align-items: center;
                transform-origin: center bottom;
                will-change: transform;
                filter: drop-shadow(0 4px 8px rgba(0,0,0,0.7));
            }
            .coop-tag-bubble {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 3px 10px 3px 4px;
                background: rgba(15, 20, 30, 0.94);
                backdrop-filter: blur(8px);
                border: 1.5px solid rgba(0, 229, 255, 0.7);
                border-radius: 999px;
                white-space: nowrap;
            }
            .coop-tag-av {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                object-fit: cover;
                border: 1.5px solid #00e5ff;
            }
            .coop-tag-col {
                display: flex;
                flex-direction: column;
                line-height: 1.15;
            }
            .coop-tag-nick {
                font-size: 11px;
                font-weight: 800;
                color: #ffffff;
                letter-spacing: 0.3px;
            }
            .coop-tag-dist {
                font-size: 9px;
                font-weight: 700;
                font-family: monospace;
            }
            .coop-tag-arrow {
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid rgba(0, 229, 255, 0.8);
                margin-top: -1px;
            }

            /* Professional Mobile First Responsiveness & Instant Touch */
            @media (max-width: 680px) {
                .subway-modal-box, .unified-box {
                    width: 95vw !important;
                    max-width: 95vw !important;
                    max-height: 92dvh !important;
                    border-radius: 12px !important;
                }
                .lobby-grid {
                    flex-direction: column !important;
                    gap: 10px !important;
                }
                .lobby-column {
                    width: 100% !important;
                }
                .lobby-header-bar {
                    flex-wrap: wrap !important;
                    gap: 8px !important;
                    padding: 8px 10px !important;
                }
                .lobby-room-badge {
                    flex: 1 1 auto !important;
                }
                .lobby-user-profile {
                    width: 100% !important;
                    justify-content: flex-start !important;
                }
                .lobby-join-box {
                    width: 100% !important;
                }
                .lobby-join-box input {
                    flex: 1 !important;
                }
                .party-slot {
                    height: 42px !important;
                    padding: 0 8px !important;
                }
                .slot-avatar {
                    width: 26px !important;
                    height: 26px !important;
                }
                .btn-ready, .btn-start-match, .btn-leave-room {
                    min-height: 44px !important;
                    font-size: 11px !important;
                    touch-action: manipulation !important;
                }
                .party-bottom-actions {
                    gap: 6px !important;
                }
                .online-players-list {
                    max-height: 140px !important;
                }
            }

            /* Global touch instant optimization */
            button, input, .party-slot, .avatar-dot-chip, .btn-mp-mode, .tab-btn {
                touch-action: manipulation !important;
                -webkit-tap-highlight-color: transparent !important;
            }
            button:active {
                transform: scale(0.97) !important;
            }

            .subway-modal-box { overflow-y: auto; }
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // 10. INITIALIZATION
    // ==========================================
    function hideHubButtons() {
        try {
            const t = window.app && window.app.title;
            if (!t) return;
            let changed = false;
            ['btnMyTour', 'btnShop', 'btnTopRun', 'btnMe', 'freeStuffButton', 'freeStuffBtn'].forEach(k => {
                const b = t[k];
                if (!b || b.__hiddenDone) return;
                b.__hiddenDone = true;
                try { if (b.parent) b.parent.removeChild(b); } catch (e) {}
                b.interactive = false;
                b.interactiveChildren = false;
                b.alpha = 0;
                b.x = -9999;
                b.y = -9999;
                try { Object.defineProperty(b, 'visible', { get: () => false, set: () => {}, configurable: true }); } catch (e) {}
                try { Object.defineProperty(b, 'renderable', { get: () => false, set: () => {}, configurable: true }); } catch (e) {}
                changed = true;
            });
            // Also scan t.children for mystery box / tv icons
            if (t.children && Array.isArray(t.children)) {
                t.children.forEach(ch => {
                    if (ch && !ch.__hiddenDone && (ch.tvIcon || ch.itemIcon || ch.itemShine || ch.arrowIcon)) {
                        ch.__hiddenDone = true;
                        try { if (ch.parent) ch.parent.removeChild(ch); } catch (e) {}
                        ch.interactive = false;
                        ch.interactiveChildren = false;
                        ch.alpha = 0;
                        ch.x = -9999;
                        ch.y = -9999;
                        try { Object.defineProperty(ch, 'visible', { get: () => false, set: () => {}, configurable: true }); } catch (e) {}
                        try { Object.defineProperty(ch, 'renderable', { get: () => false, set: () => {}, configurable: true }); } catch (e) {}
                    }
                });
            }
            if (changed && t.bottomMenu) {
                try { t.bottomMenu.organise(); } catch (e) {}
            }
        } catch (e) {}
    }
    let hubCheckCount = 0;
    const hubTimer = setInterval(() => {
        hideHubButtons();
        hubCheckCount++;
        if (hubCheckCount > 30) {
            clearInterval(hubTimer);
            setInterval(hideHubButtons, 2500);
        }
    }, 300);

    function init() {
        try {
            const urlRoom = new URLSearchParams(window.location.search).get('room');
            if (urlRoom) {
                const targetId = 'room_' + urlRoom.replace(/^#/, '').replace(/^room_/, '');
                setTimeout(() => {
                    MP.roomId = targetId;
                    MP.currentRoomTopic = 'subwaysurf/room/' + targetId;
                    MP.isPartyLeader = false;
                    MP.isReady = false;
                    MP.party = [{ ...myProfile, ready: false, isLeader: false, rseq: 0 }];
                    if (MP.mqtt && MP.mqtt.connected) MP.mqtt.subscribe(MP.currentRoomTopic);
                    renderPartySlots();
                    updateRoomCodeUI();
                    openUnifiedModal('multiplayer');
                    showHUDNotification('Conectado à sala de convite #' + urlRoom + '!');
                }, 1200);
            }
        } catch(e) {}
        try { document.body.removeAttribute("data-map-theme"); } catch(e){}
        injectModStyles();
        createUnifiedUI();
        initMultiplayerEngine();
        setupOnlineAntiPauseHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

applyGraphicsSettings(); 




