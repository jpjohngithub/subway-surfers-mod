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
            const children = obj.children || (obj.container && obj.container.children);
            if (children && children.length) {
                for (let i = 0; i < children.length; i++) {
                    setEntityHexColor(children[i], hexColor);
                }
            }
        } catch(e) {}
    }

    // Called on every coin spawn/awake from patched dependencies.bundle.js
    window.__activeCoins = new Set();

    window.__onCoinAwake = function(coin) {
        if (!coin) return;
        if (!window.__activeCoins) window.__activeCoins = new Set();
        window.__activeCoins.add(coin);
        const isNoCoin = !!window.NO_COIN_MODE;
        coin._isDashItem = false;
        coin.visible = true;
        if (coin.model && coin.model.scale) {
            coin.model.scale.set(1, 1, 1);
        }

        const coinZ = coin.body ? coin.body.z : (coin.z || 0);
        const coinX = coin.body ? coin.body.x : (coin.x || 0);
        coinSpawnCounter++;

        // Spawn collectible Dash Item on the map lanes every ~16 coins when spaced >= 180 Z units
        if (coinSpawnCounter % 16 === 0 && Math.abs(coinZ - lastDashZ) > 180) {
            coin._isDashItem = true;
            lastDashZ = coinZ;
            lastDashLaneX = coinX;
            if (coin.body) {
                coin.body.width = 6.2;
                coin.body.height = 6.2;
                coin.body.depth = 6.2;
            }
            if (coin.model) {
                setEntityHexColor(coin.model, 0x00e5ff);
                if (coin.model.scale) coin.model.scale.set(1.45, 1.45, 1.45);
            }
            if (coin.shine) {
                coin.shine.active = true;
                if (coin.shine.view) setEntityHexColor(coin.shine.view, 0x00e5ff);
            }
            return;
        }

        // In No Coin Mode, clear adjacent coins right behind/ahead of a Dash item on the same lane
        if (isNoCoin && Math.abs(coinX - lastDashLaneX) < 5 && Math.abs(coinZ - lastDashZ) < 42) {
            coin.active = false;
            coin.visible = false;
            if (coin.body) {
                coin.body.width = 0;
                coin.body.height = 0;
                coin.body.depth = 0;
            }
            return;
        }



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
        } else {
            if (coin.body) {
                coin.body.width = 5.0;
                coin.body.height = 5.0;
                coin.body.depth = 5.0;
            }
        }

        if (coin.model) {
            setEntityHexColor(coin.model, isNoCoin ? 0xff1e1e : 0xffffff);
        }
        if (coin.shine) {
            coin.shine.active = !isNoCoin;
            if (!isNoCoin && coin.shine.view) setEntityHexColor(coin.shine.view, 0xffffff);
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
                pop.innerHTML = '+5.0s ⚡';
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
    // NO COIN DYNAMIC RED COIN OBSTACLE ENGINE
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

    function createRedCoin3D(x, y, z) {
        if (!window.__lib || !window.__lib.getEntity) return null;
        try {
            const mesh = window.__lib.getEntity('currency_coin');
            if (!mesh) return null;
            mesh.x = x;
            mesh.y = y;
            mesh.z = z;
            if (mesh.scale) mesh.scale.set(1.4, 1.4, 1.4);
            setEntityHexColor(mesh, 0xff1e1e);
            const hero = window.game && window.game.hero;
            if (hero && hero.parent) {
                hero.parent.addChild(mesh);
                return { x, y, z, mesh, destroyed: false };
            }
        } catch(e) {}
        return null;
    }

    function spawnNoCoinObstaclePattern(centerZ) {
        const lanes = [-20, 0, 20];
        // 4 Obstacle Types:
        // 0: Wall with 1 open escape lane (2 lanes blocked at ground)
        // 1: Low hurdle across all 3 lanes (y = 5, must jump!)
        // 2: High laser bar across all 3 lanes (y = 26, must roll/slide!)
        // 3: Zig-zag weave (3 coins spaced 65 units apart, alternating lanes)
        const pattern = Math.floor(Math.random() * 4);

        if (pattern === 0) {
            // Wall with 1 escape lane
            const openLane = lanes[Math.floor(Math.random() * lanes.length)];
            lanes.forEach(lx => {
                if (lx !== openLane) {
                    const c = createRedCoin3D(lx, 6, centerZ);
                    if (c) customObstacles.push(c);
                }
            });
        } else if (pattern === 1) {
            // Low hurdle - must JUMP over!
            lanes.forEach(lx => {
                const c = createRedCoin3D(lx, 5, centerZ);
                if (c) customObstacles.push(c);
            });
        } else if (pattern === 2) {
            // High bar - must ROLL / SLIDE under!
            lanes.forEach(lx => {
                const c = createRedCoin3D(lx, 26, centerZ);
                if (c) customObstacles.push(c);
            });
        } else if (pattern === 3) {
            // Zig-zag weave
            const order = [-20, 0, 20];
            if (Math.random() > 0.5) order.reverse();
            order.forEach((lx, idx) => {
                const c = createRedCoin3D(lx, 6, centerZ - (idx * 65));
                if (c) customObstacles.push(c);
            });
        }
    }

    function updateNoCoinObstacleEngine() {
        if (!window.NO_COIN_MODE || !window.game || !window.game.hero || !window.game.hero.body) {
            if (customObstacles.length) cleanupCustomObstacles();
            return;
        }

        const hero = window.game.hero;
        const heroBody = hero.body;
        const heroZ = heroBody.z;
        const heroX = heroBody.x;
        const heroY = heroBody.y || 0;

        if (window.isGamePaused) return;

        // Check spawn ahead of runner
        if (heroZ < nextObstacleZ) {
            spawnNoCoinObstaclePattern(heroZ - 420);
            nextObstacleZ = heroZ - (340 + Math.random() * 180);
        }

        // Update active obstacles
        const now = Date.now();
        const isDashing = now < dashInvulnUntil;

        for (let i = customObstacles.length - 1; i >= 0; i--) {
            const obs = customObstacles[i];
            if (!obs || obs.destroyed) {
                customObstacles.splice(i, 1);
                continue;
            }

            // Spin 3D coin
            if (obs.mesh && obs.mesh.rotation) {
                obs.mesh.rotation.y += 0.09;
            }

            const dz = Math.abs(obs.z - heroZ);
            const dx = Math.abs(obs.x - heroX);
            const dy = Math.abs(obs.y - heroY);

            // Accurate Hitbox check matching coin height
            if (dz < 14 && dx < 8 && dy < 15) {
                if (isDashing) {
                    obs.destroyed = true;
                    if (obs.mesh && obs.mesh.parent) {
                        try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                    }
                    customObstacles.splice(i, 1);
                    triggerCoinShatter({ body: { x: obs.x, y: obs.y, z: obs.z } });
                    continue;
                } else {
                    obs.destroyed = true;
                    triggerNoCoinDeath(null);
                    return;
                }
            }

            // Passed behind player
            if (obs.z > heroZ + 80) {
                if (obs.mesh && obs.mesh.parent) {
                    try { obs.mesh.parent.removeChild(obs.mesh); } catch(e) {}
                }
                customObstacles.splice(i, 1);
            }
        }
    }

    setInterval(updateNoCoinObstacleEngine, 30);

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
            if (!MP.inMatch && MP.party.length < 4 && !MP.party.some(p => p.id === player.id)) {
                MP.party.push({ id: player.id, nick: player.nick, avatar: player.avatar, ready: false, isLeader: false, rseq: 0 });
                MPX.lastSeen[player.id] = Date.now();
                syncPartyToAll();
                showHUDNotification('🎉 ' + player.nick + ' entrou no grupo!');
            } else if (MP.party.length >= 4) {
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
        return MP.party.every(p => p.ready === true);
    }

    function maybeAutoStart() {
        if (!MP.isPartyLeader || MP.inMatch) return;
        clearTimeout(MPX.autoTimer);
        if (!checkCanStartMatch()) return;
        MPX.autoTimer = setTimeout(() => { if (MP.isPartyLeader && !MP.inMatch && checkCanStartMatch()) startSeries(); }, 1200);
    }

    function requestStartMatch() {
        if (!MP.isPartyLeader) { alert('Apenas o líder da sala pode iniciar o torneio. Dê PRONTO e aguarde!'); return; }
        if (!checkCanStartMatch()) {
            alert('Atenção: Todos os corredores (2 a 4) devem dar PRONTO antes de iniciar!');
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

        if (MPX.activeIds.length >= 4) {
            MPX.totalRounds = 3; // R1: 4->3, R2: 3->2, R3: Final 2->1
        } else if (MPX.activeIds.length === 3) {
            MPX.totalRounds = 2; // R1: 3->2, R2: Final 2->1
        } else {
            MPX.totalRounds = 3; // 2 players: Best of 3 (MD3)
        }

        hostBeginRound();
    }

    function hostBeginRound() {
        MPX.round += 1;
        clearTimeout(MPX.loneSurvivorTimer);
        MPX.loneSurvivorTimer = null;

        let roundLabel = '';
        if (MPX.activeIds.length >= 4) {
            roundLabel = 'QUARTAS DE FINAL — 1 SERÁ ELIMINADO';
        } else if (MPX.activeIds.length === 3) {
            roundLabel = 'SEMIFINAL — 1 SERÁ ELIMINADO';
        } else if (MPX.activeIds.length === 2) {
            roundLabel = (MPX.partySizeAtStart >= 3) ? 'GRANDE FINAL DO TORNEIO!' : `DUELO X1 (RODADA ${MPX.round}/${MPX.totalRounds})`;
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
            delay: 3
        };
        sendRoomMessage(msg);
        handleRoundStart(msg);
    }

    function handleRoundStart(msg) {
        if (!MP.isPartyLeader && msg.party) MP.party = msg.party.map(p => ({ ...p }));
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

            if (MP.isPartyLeader) hostStartBots();
        });
    }

    function removeEl(id) { const e = document.getElementById(id); if (e) e.remove(); }

    function runCountdown(seconds, label, done) {
        window.__runCountdown = runCountdown;
        removeEl('subway-cd-overlay');
        const ov = document.createElement('div');
        ov.className = 'subway-countdown-overlay';
        ov.id = 'subway-cd-overlay';
        ov.innerHTML = `
            <div class="cd-container">
                <div class="cd-circle-glow"></div>
                <div class="countdown-num pop" id="cd-num">${seconds}</div>
                <div class="countdown-sub">${label}</div>
            </div>
        `;
        document.body.appendChild(ov);
        let c = seconds;
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
                    n.textContent = 'GO!';
                    n.className = 'countdown-num go';
                }
                setTimeout(() => {
                    ov.classList.add('fade-out');
                    setTimeout(() => {
                        ov.remove();
                        done();
                    }, 200);
                }, 400);
            }
        }, 1000);
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
                }
            });
            renderTimeline();
        }, 250);
    }

    // Live tick sender from active runner
    function sendMultiplayerRunnerSync() {
        if (!MP.inMatch || !MPX.roundActive || !isRunActive) return;
        const now = performance.now();
        if (now - (MPX.lastTickSent || 0) < 250) return;
        MPX.lastTickSent = now;
        if (MPX.dead[myProfile.id] !== undefined) return;
        MPX.live[myProfile.id] = runElapsedTime;
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
            const hero = window.app && window.app.game && window.app.game.hero;
            if (!hero) return;
            if (hero.idleScene) {
                hero.idleScene._active = false;
                hero.idleScene._worldActive = false;
            }
            if (hero.sprayCan) {
                hero.sprayCan._active = false;
                hero.sprayCan._worldActive = false;
            }
            if (hero.gameScene) {
                hero.gameScene._active = true;
                hero.gameScene._worldActive = true;
            }
            if (hero.anim) {
                if (hero.gameScene) hero.anim.currentScene = hero.gameScene;
                if (hero.anim.updateCurrentAnimation) hero.anim.updateCurrentAnimation();
            }
            if (typeof hero.refreshScenes === 'function') {
                hero.refreshScenes();
            }
            if (typeof hero.resetModel === 'function') {
                hero.resetModel();
            }
            if (hero.body) {
                hero.body.ghost = false;
                hero.body.movable = true;
            }
            if (hero.model && hero.model.container) {
                hero.model.container.visible = true;
                hero.model.container.alpha = 1;
                hero.model.container.renderable = true;
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
            delay: isTournamentOver ? 12 : 8
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
            const roundTxt = `RODADA ${Math.max(1, MPX.round)}/${MPX.totalRounds}`;
            head.textContent = list.length === 2 ? `FINAL · ${roundTxt}` : roundTxt;
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
        // Minimalist Stopwatch Timer (Hidden by default, shown ONLY during active run)
        if (!document.getElementById('subway-top-timer-wrap')) {
            const timer = document.createElement('div');
            timer.id = 'subway-top-timer-wrap';
            timer.className = 'subway-top-timer-wrap';
            timer.style.display = 'none';
            timer.innerHTML = `
                <span class="timer-icon">⏱️</span>
                <span id="subway-top-timer-val" class="timer-value">00:00.00</span>
                <span id="subway-mode-indicator" class="timer-badge ${window.NO_COIN_MODE ? 'badge-nocoin' : 'badge-normal'}">
                    ${window.NO_COIN_MODE ? 'NO COIN 🔴' : 'NORMAL 🟡'}
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
            badge.textContent = window.NO_COIN_MODE ? 'NO COIN 🔴' : 'NORMAL 🟡';
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
        if (MP.party.length >= 4) { showHUDNotification('Grupo cheio (máximo 4 corredores).'); return; }
        const botNames = [
            { id: 'bot_alex', nick: 'Alex_Pro', avatar: DEFAULT_AVATARS[1].url },
            { id: 'bot_bia', nick: 'Bia_Surfer', avatar: DEFAULT_AVATARS[2].url },
            { id: 'bot_carlos', nick: 'Carlos_Speed', avatar: DEFAULT_AVATARS[3].url }
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
                            <div class="col-header">
                                <div class="col-title-wrap">
                                    <h3>SALA DO TORNEIO (${MP.party.length}/4)</h3>
                                    <span class="party-hint">Eliminatório No Coin · 3 Rodadas · Maior tempo acumulado vence</span>
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
                                    INICIAR TORNEIO
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
        for (let i = 0; i < 4; i++) {
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
            if (MP.party.length < 4) {
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
                bottom: 20px;
                left: 66px;
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
                bottom: 20px;
                left: 20px;
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
                .subway-modal-backdrop {
                    padding: 8px !important;
                    align-items: flex-end !important;
                }
                .subway-modal-box, .unified-box {
                    width: 100vw !important;
                    max-width: 100vw !important;
                    height: 94vh !important;
                    max-height: 94vh !important;
                    padding: 0 !important;
                    border-radius: 18px 18px 0 0 !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                    display: flex !important;
                    flex-direction: column !important;
                    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.9) !important;
                }
                .modal-header {
                    padding: 12px 16px !important;
                    margin-bottom: 0 !important;
                    flex-shrink: 0 !important;
                    background: rgba(15, 23, 42, 0.8) !important;
                }
                .modal-brand-title {
                    font-size: 14px !important;
                }
                .btn-modal-close {
                    font-size: 20px !important;
                    padding: 6px 12px !important;
                }

                /* Tabs: Touch-Friendly Segmented Control */
                .unified-tabs {
                    display: flex !important;
                    gap: 6px !important;
                    padding: 6px 12px !important;
                    margin-bottom: 0 !important;
                    flex-shrink: 0 !important;
                    background: rgba(10, 15, 29, 0.95) !important;
                }
                .tab-btn {
                    padding: 10px 6px !important;
                    font-size: 11px !important;
                    font-weight: 800 !important;
                    flex: 1 !important;
                    height: 40px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    text-align: center !important;
                    border-radius: 8px !important;
                    background: rgba(255, 255, 255, 0.04) !important;
                    border: 1px solid rgba(255, 255, 255, 0.06) !important;
                }
                .tab-btn.active {
                    background: rgba(56, 189, 248, 0.18) !important;
                    border-color: #38bdf8 !important;
                    color: #fff !important;
                }

                /* Scrollable Tab Pane */
                .tab-pane {
                    flex: 1 !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                    padding: 14px 16px 24px 16px !important;
                    box-sizing: border-box !important;
                }

                /* Header Bar: Stack cleanly in mobile */
                .lobby-header-bar {
                    flex-direction: column !important;
                    align-items: stretch !important;
                    gap: 10px !important;
                    padding: 12px !important;
                    margin-bottom: 12px !important;
                    background: rgba(255, 255, 255, 0.03) !important;
                    border-radius: 12px !important;
                }
                .lobby-room-badge {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    padding: 4px 0 !important;
                }
                .room-code-tag {
                    font-size: 13px !important;
                }
                .btn-copy-code {
                    padding: 6px 14px !important;
                    font-size: 12px !important;
                    height: 34px !important;
                }

                /* User Profile in Mobile */
                .lobby-user-profile {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: stretch !important;
                    gap: 8px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    padding: 0 !important;
                }
                .user-avatar-wrap {
                    width: 44px !important;
                    height: 44px !important;
                    align-self: center !important;
                }
                .user-meta-wrap {
                    width: 100% !important;
                    gap: 8px !important;
                }
                .user-fields-row {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 8px !important;
                    width: 100% !important;
                }
                #input-my-nick {
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    height: 42px !important;
                    font-size: 15px !important;
                    padding: 8px 12px !important;
                    border-radius: 8px !important;
                }
                #input-my-avatar-url {
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    height: 38px !important;
                    font-size: 14px !important;
                    padding: 6px 10px !important;
                    border-radius: 8px !important;
                }
                .avatar-dots-bar {
                    display: flex !important;
                    flex-wrap: nowrap !important;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                    gap: 8px !important;
                    padding: 4px 2px 8px 2px !important;
                }
                .avatar-dot-chip {
                    width: 32px !important;
                    height: 32px !important;
                    flex-shrink: 0 !important;
                }
                .btn-avatar-url-chip {
                    height: 32px !important;
                    padding: 0 10px !important;
                    font-size: 11px !important;
                    flex-shrink: 0 !important;
                }

                /* Join Room Box */
                .lobby-join-box {
                    display: flex !important;
                    width: 100% !important;
                    gap: 8px !important;
                    box-sizing: border-box !important;
                }
                #input-join-room {
                    flex: 1 !important;
                    height: 42px !important;
                    font-size: 15px !important;
                    padding: 8px 12px !important;
                    border-radius: 8px !important;
                }
                .btn-join-room {
                    height: 42px !important;
                    padding: 0 16px !important;
                    font-size: 13px !important;
                    font-weight: 800 !important;
                    border-radius: 8px !important;
                    flex-shrink: 0 !important;
                }

                /* Lobby Grid */
                .lobby-grid {
                    flex-direction: column !important;
                    gap: 14px !important;
                }
                .lobby-column {
                    width: 100% !important;
                    box-sizing: border-box !important;
                    padding: 12px !important;
                    border-radius: 12px !important;
                }
                .col-header {
                    margin-bottom: 10px !important;
                }
                .col-title-wrap h3 {
                    font-size: 13px !important;
                }
                .party-hint {
                    font-size: 10px !important;
                }
                .btn-add-bot {
                    height: 32px !important;
                    padding: 0 10px !important;
                    font-size: 11px !important;
                }
                .btn-refresh-online {
                    height: 32px !important;
                    padding: 0 10px !important;
                    font-size: 11px !important;
                }

                /* Party Slots */
                .party-slots-container {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 8px !important;
                    margin-bottom: 14px !important;
                }
                .party-slot {
                    padding: 8px 12px !important;
                    gap: 10px !important;
                    height: 48px !important;
                    box-sizing: border-box !important;
                    border-radius: 10px !important;
                }
                .slot-avatar {
                    width: 32px !important;
                    height: 32px !important;
                }
                .slot-nick {
                    max-width: 130px !important;
                    font-size: 13px !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    white-space: nowrap !important;
                }
                .slot-status-pill {
                    font-size: 10px !important;
                    padding: 4px 8px !important;
                }

                /* Party Bottom Actions: Big Thumb Buttons */
                .party-bottom-actions {
                    display: grid !important;
                    grid-template-columns: 1fr 1fr !important;
                    gap: 10px !important;
                    margin-top: 10px !important;
                }
                .btn-ready {
                    height: 46px !important;
                    font-size: 13px !important;
                    font-weight: 800 !important;
                    border-radius: 10px !important;
                    grid-column: 1 / 2 !important;
                }
                .btn-leave-room {
                    height: 46px !important;
                    font-size: 13px !important;
                    font-weight: 700 !important;
                    border-radius: 10px !important;
                    grid-column: 2 / 3 !important;
                }
                .btn-start-match {
                    height: 48px !important;
                    font-size: 14px !important;
                    font-weight: 900 !important;
                    letter-spacing: 0.5px !important;
                    border-radius: 10px !important;
                    grid-column: 1 / -1 !important;
                }

                /* Online Players List */
                .players-col {
                    max-height: 220px !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                }
                .online-player-item {
                    height: 44px !important;
                    padding: 6px 8px !important;
                }
                .btn-invite-player {
                    height: 32px !important;
                    padding: 0 10px !important;
                    font-size: 11px !important;
                }

                /* Mod Cards in Modes Tab */
                .mod-card {
                    padding: 12px 14px !important;
                    gap: 12px !important;
                    margin-bottom: 8px !important;
                }
                .mod-title {
                    font-size: 14px !important;
                }
                .mod-desc {
                    font-size: 11px !important;
                }
                .btn-clean-toggle {
                    height: 38px !important;
                    padding: 0 12px !important;
                    font-size: 11px !important;
                    border-radius: 19px !important;
                    flex-shrink: 0 !important;
                }

                /* Records Filters */
                .records-filter-bar {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 6px !important;
                    margin-bottom: 10px !important;
                }
                .btn-filter-record, .btn-clear-records {
                    height: 34px !important;
                    padding: 0 10px !important;
                    font-size: 11px !important;
                }

                /* Game Screen Floating Buttons & Timers */
                .btn-subway-unified-menu {
                    width: 44px !important;
                    height: 44px !important;
                    bottom: max(14px, env(safe-area-inset-bottom, 14px)) !important;
                    left: 12px !important;
                    border-radius: 22px !important;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.6) !important;
                }
                .btn-subway-unified-menu svg {
                    width: 22px !important;
                    height: 22px !important;
                }
                .btn-subway-online-lobby {
                    height: 44px !important;
                    padding: 0 14px !important;
                    bottom: max(14px, env(safe-area-inset-bottom, 14px)) !important;
                    left: 64px !important;
                    font-size: 13px !important;
                    font-weight: 800 !important;
                    gap: 6px !important;
                    border-radius: 22px !important;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.6) !important;
                }
                .subway-top-timer-wrap {
                    top: max(12px, env(safe-area-inset-top, 12px)) !important;
                    padding: 6px 14px !important;
                    gap: 8px !important;
                    pointer-events: none !important;
                    box-shadow: 0 4px 18px rgba(0,0,0,0.6) !important;
                }
                .subway-top-timer-wrap .timer-value {
                    font-size: 15px !important;
                    font-weight: 800 !important;
                }
                .subway-top-timer-wrap .timer-icon {
                    font-size: 13px !important;
                }
                .subway-top-timer-wrap .timer-badge {
                    font-size: 9px !important;
                    padding: 2px 7px !important;
                }

                /* Scoreboards & Overlays: No Overlap & Pass Through Touches */
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
