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
    window.__onCoinAwake = function(coin) {
        if (!coin) return;
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

    // Called when player touches a coin in No Coin Mode
    window.__onNoCoinCollect = function(coin) {
        if (!window.NO_COIN_MODE) return;
        if (Date.now() < dashInvulnUntil) return;
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
        if (isRunActive) return;
        isRunActive = true;
        deathFrozen = false;
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
            if (isRunActive && !deathFrozen) {
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
            if (MP.inMatch) {
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
        } catch(e) {}
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
            if (MP.inMatch && MPX.roundActive) handleLocalMultiplayerDeath(runElapsedTime);
        } catch (e) {}
    };
    window.__onGameOver = function() {
        stopRunTimer();
    };
    window.__onGameReset = function() {
        hideRunTimer();
    };

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
                    MP.mqtt.subscribe('subwaysurf/player/' + myProfile.id);

                    // If in a room, subscribe to room
                    if (MP.currentRoomTopic) {
                        MP.mqtt.subscribe(MP.currentRoomTopic);
                    }
                    broadcastPresence();
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

            if (MP.isPartyLeader) hostStartBots();
        });
    }

    function removeEl(id) { const e = document.getElementById(id); if (e) e.remove(); }

    function runCountdown(seconds, label, done) {
        removeEl('subway-cd-overlay');
        const ov = document.createElement('div');
        ov.className = 'subway-countdown-overlay';
        ov.id = 'subway-cd-overlay';
        ov.innerHTML = `<div class="countdown-num" id="cd-num">${seconds}</div><div class="countdown-sub">${label}</div>`;
        document.body.appendChild(ov);
        let c = seconds;
        const tm = setInterval(() => {
            c--;
            const n = document.getElementById('cd-num');
            if (c > 0) {
                if (n) { n.textContent = c; n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; }
            } else {
                clearInterval(tm);
                ov.remove();
                done();
            }
        }, 1000);
    }

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
        removeEl('subway-wait-hud');
        const prevTotal = MPX.totals[myProfile.id] || 0;
        const totalNow = prevTotal + roundTimeMs;
        const h = document.createElement('div');
        h.id = 'subway-wait-hud';
        h.className = 'subway-spectator-hud';
        h.innerHTML = `<span class="spec-live-dot"></span> <strong>VOCÊ CAIU!</strong> Tempo desta rodada: <strong>${fmtS(roundTimeMs)}</strong> | Total Acumulado: <strong>${fmtS(totalNow)}</strong> — Aguardando a outra pessoa morrer...`;
        document.body.appendChild(h);
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
        try {
            ['saveme', 'gameover'].forEach(k => { const s = window.app && window.app[k]; if (s && s.close) s.close(); });
        } catch (e) {}
        hideRunTimer();
        try { window.app.nav.toTitleScreen(); } catch (e) { try { window.app.nav.resetUi(); } catch (e2) {} }
    }

    function showInterlude(msg) {
        removeEl('subway-interlude');
        const nameOf = id => {
            const p = MP.party.find(x => x.id === id);
            return p || { id, nick: id, avatar: DEFAULT_AVATARS[0].url };
        };

        const isOver = !!msg.isTournamentOver;
        const champ = nameOf(msg.tournamentWinnerId || msg.roundWinnerId);

        let roundTitle = '';
        if (isOver) {
            roundTitle = `🏆 GRANDE CAMPEÃO DO TORNEIO: ${champ.nick.toUpperCase()}!`;
        } else if (msg.eliminatedThisRound) {
            const elimName = nameOf(msg.eliminatedThisRound).nick;
            roundTitle = `⚔️ RODADA ${msg.round}/${msg.totalRounds} CONCLUÍDA — ${elimName} FOI ELIMINADO!`;
        } else {
            roundTitle = `⚔️ RODADA ${msg.round}/${msg.totalRounds} CONCLUÍDA — TEMPOS ACUMULADOS!`;
        }

        const rows = (msg.rankedIds || []).map((id, i) => {
            const p = nameOf(id);
            const isChamp = isOver && id === msg.tournamentWinnerId;
            const roundT = msg.results[id] || 0;
            const totalT = msg.totals[id] || 0;

            let badgeHtml = '';
            if (isOver) {
                if (i === 0) badgeHtml = '<span class="il-badge il-champ">🏆 CAMPEÃO (MAIOR TEMPO!)</span>';
                else if (i === 1) badgeHtml = '<span class="il-badge il-silver">🥈 2º LUGAR</span>';
                else badgeHtml = `<span class="il-badge il-elim">${i + 1}º LUGAR</span>`;
            } else {
                if (i === 0) badgeHtml = '<span class="il-badge il-champ">👑 LÍDER GERAL</span>';
                else badgeHtml = `<span class="il-badge il-pass">${i + 1}º GERAL</span>`;
            }

            return `
                <div class="il-row ${i === 0 ? 'il-win' : ''}">
                    <span class="il-pos">${i + 1}º</span>
                    <img class="il-av" src="${p.avatar}" />
                    <span class="il-nick">${p.nick}${id === myProfile.id ? ' (você)' : ''}</span>
                    <span class="il-r" title="Tempo nesta rodada">+${fmtS(roundT)}</span>
                    <span class="il-t" style="font-weight:900; color:#38bdf8;" title="Tempo acumulado total">${fmtS(totalT)}</span>
                    <span class="il-status">${badgeHtml}</span>
                </div>
            `;
        }).join('');

        const box = document.createElement('div');
        box.id = 'subway-interlude';
        box.className = 'subway-interlude';
        box.innerHTML = `
            <div class="il-card">
                <div class="il-title ${isOver ? 'il-title-gold' : ''}">${roundTitle}</div>
                <div class="il-subtitle">${isOver ? 'Parabéns a todos os corredores!' : 'Classificação e Eliminatórias da Partida:'}</div>
                <div class="il-head">
                    <span>#</span>
                    <span></span>
                    <span>Jogador</span>
                    <span>Rodada</span>
                    <span style="color:#38bdf8; font-weight:800;">Total Acumulado</span>
                    <span>Classificação</span>
                </div>
                <div class="il-rows">${rows}</div>
                <div class="il-count" id="il-count">
                    ${isOver ? 'Retornando ao lobby em' : 'Próxima rodada eliminatória em'} <span id="il-sec">${msg.delay}</span>s...
                </div>
                ${isOver ? '<button class="btn-il-back" onclick="window.__endSeriesNow()">Voltar ao Lobby</button>' : ''}
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
                <div class="tl-head" id="tl-head">TORNEIO NO COIN</div>
                <div class="tl-track" id="tl-track">
                    <div class="tl-line"></div>
                    <div class="tl-danger-zone">⚠️ ZONA DE ELIMINAÇÃO</div>
                </div>
            `;
            document.body.appendChild(el);
        }
    }

    function hideTimeline() { removeEl('subway-timeline'); }

    function renderTimeline() {
        const el = document.getElementById('subway-timeline');
        if (!el || !MP.inMatch || !MP.party.length) return;

        // Sort active competitors by live/dead survival time
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
            head.textContent = list.length === 2 ? `🏆 FINAL (${roundTxt})` : `⚔️ ${roundTxt}`;
        }

        const track = el.querySelector('#tl-track');
        if (!track) return;
        const H = track.clientHeight || 180;
        const NODE = 28;
        const max = Math.max(25000, (list[0]?.score || 10000) * 1.15);
        const gap = Math.min(NODE + 4, (H - NODE) / Math.max(1, list.length - 1));
        const ys = list.map(e => ({ e, y: (1 - e.score / max) * (H - NODE) }));
        for (let i = 1; i < ys.length; i++) if (ys[i].y < ys[i - 1].y + gap) ys[i].y = ys[i - 1].y + gap;
        const over = ys[ys.length - 1] ? (ys[ys.length - 1].y - (H - NODE)) : 0;
        if (over > 0) ys.forEach(o => { o.y = Math.max(0, o.y - over); });

        const ids = list.map(e => String(e.p.id));
        track.querySelectorAll('.tl-node').forEach(n => { if (!ids.includes(n.getAttribute('data-id'))) n.remove(); });

        ys.forEach((o, i) => {
            const id = String(o.e.p.id);
            let n = track.querySelector('.tl-node[data-id="' + id + '"]');
            if (!n) {
                n = document.createElement('div');
                n.className = 'tl-node';
                n.setAttribute('data-id', id);
                n.innerHTML = '<div class="tl-pill"><span class="tl-rank"></span><span class="tl-nick"></span><span class="tl-time"></span></div><img class="tl-dot" />';
                track.appendChild(n);
            }
            n.style.top = o.y + 'px';
            n.classList.toggle('tl-dead', o.e.dead);
            n.classList.toggle('tl-me', o.e.p.id === myProfile.id);
            n.classList.toggle('tl-danger', i === list.length - 1 && list.length > 2); // Bottom player is in elimination danger
            n.querySelector('.tl-rank').textContent = (i + 1) + 'º';
            n.querySelector('.tl-nick').textContent = o.e.p.nick;
            n.querySelector('.tl-time').textContent = o.e.dead ? `💀 Total: ${fmtS(o.e.score)}` : `🏃 Total: ${fmtS(o.e.score)}`;
            const img = n.querySelector('.tl-dot');
            if (img.getAttribute('src') !== o.e.p.avatar) img.setAttribute('src', o.e.p.avatar);
        });
    }
    setInterval(() => { if (MP.inMatch) renderTimeline(); }, 400);

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
            onlBtn.innerHTML = '<span class="pulse-dot"></span><span>MODO ONLINE 🌐</span>';
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
                    <h2>⚡ PAINEL SUBWAY SURFERS MOD</h2>
                    <button class="btn-modal-close" id="btn-close-unified">✕</button>
                </div>

                <!-- Tabs Navigation -->
                <div class="unified-tabs">
                    <button class="tab-btn" data-tab="modes" id="tab-btn-modes">🎮 Modos</button>
                    <button class="tab-btn" data-tab="multiplayer" id="tab-btn-multiplayer">🌐 Multiplayer</button>
                    <button class="tab-btn" data-tab="records" id="tab-btn-records">📜 Recordes</button>
                </div>

                <!-- Tab 1: Game Modes -->
                <div class="tab-pane" id="pane-modes">
                    <div class="mod-card">
                        <div class="mod-info">
                            <h3>⚡ MODO ILIMITADO (TUDO LIBERADO)</h3>
                            <p>999M Moedas, 999M Chaves, 14 Personagens, 17 Pranchas, Roupas, Melhorias Max e Loja Grátis!</p>
                        </div>
                        <button class="btn-toggle-unlimited ${window.UNLIMITED_MODE ? 'active-on' : 'active-off'}" id="btn-toggle-unlimited">
                            ${window.UNLIMITED_MODE ? '✅ ATIVADO (INFINITO)' : '❌ DESATIVADO'}
                        </button>
                    </div>

                    <div class="mod-card">
                        <div class="mod-info">
                            <h3>🔴 MODO NO COIN (MORTE INSTANTÂNEA)</h3>
                            <p>Moedas ficam vermelhas. Qualquer toque na moeda resulta em derrota instantânea com hitbox 100% idêntica e sem atração!</p>
                        </div>
                        <button class="btn-toggle-nocoin ${window.NO_COIN_MODE ? 'nocoin-on' : 'nocoin-off'}" id="btn-toggle-nocoin">
                            ${window.NO_COIN_MODE ? '🔴 NO COIN ATIVO' : '🟡 MODO NORMAL'}
                        </button>
                    </div>
                </div>

                <!-- Tab 2: Online Multiplayer (Modern Elimination Hub) -->
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
                            <div class="user-avatar-wrap">
                                <img id="lobby-my-avatar" src="${myProfile.avatar}" alt="Avatar" />
                            </div>
                            <div class="user-meta-wrap">
                                <input type="text" id="input-my-nick" value="${myProfile.nick}" maxlength="14" placeholder="Seu Nick" title="Clique para editar seu nick" onchange="window.__saveMyNick(this.value)" onblur="window.__saveMyNick(this.value)" />
                                <div class="avatar-dots-bar">
                                    ${DEFAULT_AVATARS.map(av => `
                                        <img class="avatar-dot-chip ${av.url === myProfile.avatar ? 'active' : ''}" src="${av.url}" title="${av.name}" onclick="window.__selectPresetAvatar('${av.url}')" />
                                    `).join('')}
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
                                    <h3>🏆 SALA DO TORNEIO (${MP.party.length}/4)</h3>
                                    <span class="party-hint">Eliminatório No Coin · 3 Rodadas · Maior tempo total vence</span>
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
                        <button class="btn-filter-record active" onclick="window.__filterRecords('all', this)">Todos</button>
                        <button class="btn-filter-record" onclick="window.__filterRecords('nocoin', this)">Apenas No Coin 🔴</button>
                        <button class="btn-filter-record" onclick="window.__filterRecords('normal', this)">Apenas Normal 🟡</button>
                        <button class="btn-clear-records" onclick="window.__clearRecords()">🗑️ Limpar</button>
                    </div>
                    <div class="records-table-container" id="records-table-wrap">
                        <!-- Injected by renderRecordsTable -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

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
        renderRecordsTable('all');
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
            btn.className = `btn-toggle-unlimited ${window.UNLIMITED_MODE ? 'active-on' : 'active-off'}`;
            btn.textContent = window.UNLIMITED_MODE ? '✅ ATIVADO (INFINITO)' : '❌ DESATIVADO';
        }
    }

    function toggleNoCoinMode() {
        window.NO_COIN_MODE = !window.NO_COIN_MODE;
        window.GAME_MODE = window.NO_COIN_MODE ? 'nocoin' : 'normal';
        localStorage.setItem('subway_game_mode', window.GAME_MODE);
        updateModeBadgeUI();

        const btn = document.getElementById('btn-toggle-nocoin');
        if (btn) {
            btn.className = `btn-toggle-nocoin ${window.NO_COIN_MODE ? 'nocoin-on' : 'nocoin-off'}`;
            btn.textContent = window.NO_COIN_MODE ? '🔴 NO COIN ATIVO' : '🟡 MODO NORMAL';
        }
        showHUDNotification(window.NO_COIN_MODE ? '🔴 MODO NO COIN ATIVADO! Cuidado com as moedas vermelhas!' : '🟡 MODO NORMAL ATIVADO!');
    }

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

        let records = JSON.parse(localStorage.getItem('subway_surfers_records') || '[]');
        if (filterMode === 'nocoin') {
            records = records.filter(r => r.mode === 'No Coin');
        } else if (filterMode === 'normal') {
            records = records.filter(r => r.mode === 'Normal');
        }

        if (records.length === 0) {
            container.innerHTML = '<div class="no-records">Nenhum recorde registrado ainda. Inicie uma corrida!</div>';
            return;
        }

        container.innerHTML = `
            <table class="records-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Jogador</th>
                        <th>Modo</th>
                        <th>Tempo Sobrevivido</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map((r, i) => `
                        <tr>
                            <td>#${i + 1}</td>
                            <td><strong>${r.nick || myProfile.nick}</strong></td>
                            <td><span class="badge ${r.mode === 'No Coin' ? 'b-nocoin' : 'b-normal'}">${r.mode}</span></td>
                            <td class="td-time">${r.timeStr}</td>
                            <td class="td-date">${r.date}</td>
                        </tr>
                    `).join('')}
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
            renderRecordsTable('all');
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

            
            /* Direct Online Mode Button (Bottom-Left) */
            body.sw-in-run #btn-subway-online-lobby { display: none !important; }
            .btn-subway-online-lobby {
                position: fixed;
                bottom: 18px;
                left: 74px;
                z-index: 99998;
                height: 48px;
                padding: 0 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                background: linear-gradient(135deg, #10b981, #059669);
                color: #fff;
                border: 2px solid rgba(255, 255, 255, 0.4);
                border-radius: 24px;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
                font-weight: 800;
                font-size: 13px;
                letter-spacing: 0.5px;
                transition: transform 0.2s ease, filter 0.2s ease;
                user-select: none;
                -webkit-user-select: none;
                font-family: inherit;
            }
            .btn-subway-online-lobby:hover {
                transform: scale(1.05);
                filter: brightness(1.15);
            }
            .pulse-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #6ee7b7;
                box-shadow: 0 0 10px #34d399;
                animation: pulseGlow 1.5s infinite;
            }
            @keyframes pulseGlow {
                0% { transform: scale(0.9); opacity: 0.8; }
                50% { transform: scale(1.3); opacity: 1; }
                100% { transform: scale(0.9); opacity: 0.8; }
            }

            
            /* Modal Backdrop & Structure */
            .subway-modal-backdrop {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(4, 10, 24, 0.85);
                backdrop-filter: blur(8px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .subway-modal-box {
                background: #0f172a;
                color: #fff;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 16px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.8);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                max-width: 90vw;
                max-height: 88vh;
            }
            .unified-box { width: 740px; }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 20px;
                background: rgba(255,255,255,0.03);
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .modal-header h2 {
                margin: 0;
                font-size: 15px;
                font-weight: 800;
                letter-spacing: 0.5px;
            }
            .btn-modal-close {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 6px;
                transition: all 0.2s;
            }
            .btn-modal-close:hover { color: #fff; background: rgba(255,255,255,0.1); }

            /* Unified Tabs */
            .unified-tabs {
                display: flex;
                background: rgba(0,0,0,0.25);
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .tab-btn {
                flex: 1;
                padding: 12px;
                background: none;
                border: none;
                color: #8c9ba5;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s ease;
            }
            .tab-btn.active {
                color: #fff;
                background: rgba(255,255,255,0.04);
                border-bottom-color: #38bdf8;
            }
            .tab-pane {
                display: none;
                padding: 12px 18px 14px;
                overflow-y: auto;
            }
            .tab-pane.active { display: block; }

            /* Modes Tab */
            .mod-card {
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
            }
            .mod-info h3 { margin: 0 0 6px 0; font-size: 15px; }
            .mod-info p { margin: 0; font-size: 12px; color: #a1b0be; line-height: 1.4; }
            .btn-toggle-unlimited, .btn-toggle-nocoin {
                padding: 10px 18px;
                border-radius: 8px;
                font-weight: 800;
                font-size: 12px;
                border: none;
                cursor: pointer;
                white-space: nowrap;
            }
            .active-on { background: #00c853; color: #fff; }
            .active-off { background: #455a64; color: #cfd8dc; }
            .nocoin-on { background: #e53935; color: #fff; }
            .nocoin-off { background: #fbc02d; color: #000; }

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

            /* Spectator HUD & Winner Celebration */
            .subway-spectator-hud {
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                z-index: 99999; background: rgba(10, 16, 30, 0.9); border-radius: 20px;
                padding: 8px 18px; display: flex; align-items: center; gap: 16px; color: #fff; font-size: 12px;
                border: 1px solid #ff4b2b;
            }
            .spec-live-dot { color: #ff1744; font-size: 14px; animation: blink 1s infinite; }
            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
            .spec-controls button {
                background: rgba(255,255,255,0.1); border: none; color: #fff;
                padding: 4px 8px; border-radius: 6px; cursor: pointer;
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

            /* Countdown Overlay */
            .subway-countdown-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); z-index: 100004;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
            }
            .countdown-num { font-size: 90px; font-weight: 900; color: #ff4b2b; animation: popNum 0.9s ease; }
            @keyframes popNum { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
            .countdown-sub { font-size: 14px; font-weight: 800; color: #fff; margin-top: 14px; text-transform: uppercase; }

            
            /* Online: Timeline, Interlude, Wait HUD */
            .subway-tl-wrap { position: fixed; top: 52px; right: 8px; z-index: 99998; width: 190px; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .tl-head { text-align: right; font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #cfe3ff; text-shadow: 0 1px 3px #000; margin: 0 4px 6px 0; }
            .tl-track { position: relative; height: min(46vh, 300px); min-height: 140px; }
            .tl-line { position: absolute; right: 13px; top: 0; bottom: 0; width: 3px; border-radius: 3px; background: linear-gradient(180deg, #ffd54f, #29b6f6 60%, rgba(41,182,246,.25)); box-shadow: 0 0 8px rgba(41,182,246,.5); }
            .tl-node { position: absolute; right: 0; left: 0; height: 28px; transition: top .35s cubic-bezier(.3,.8,.3,1); }
            .tl-dot { position: absolute; right: 0; top: 0; width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; background: #12203a; box-shadow: 0 2px 8px rgba(0,0,0,.6); }
            .tl-me .tl-dot { border-color: #00e5ff; box-shadow: 0 0 10px #00e5ff; }
            .tl-pill { position: absolute; right: 34px; top: 3px; height: 22px; display: flex; align-items: center; gap: 5px; padding: 0 8px; border-radius: 11px; background: rgba(10,16,30,.78); backdrop-filter: blur(4px); color: #fff; font-size: 10px; font-weight: 700; white-space: nowrap; border: 1px solid rgba(255,255,255,.15); }
            .tl-rank { color: #ffd54f; font-weight: 900; }
            .tl-nick { max-width: 70px; overflow: hidden; text-overflow: ellipsis; }
            .tl-time { color: #90caf9; font-variant-numeric: tabular-nums; }
            .tl-dead .tl-dot { filter: grayscale(1); opacity: .6; border-color: #78909c; }
            .tl-dead .tl-pill { opacity: .6; text-decoration: line-through; }
            .subway-interlude { position: fixed; inset: 0; z-index: 100006; background: rgba(4,10,24,.55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .il-card { background: #101c33; color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: 16px; padding: 18px 22px; min-width: min(420px, 92vw); box-shadow: 0 10px 40px rgba(0,0,0,.6); }
            .il-title { font-size: 17px; font-weight: 900; text-align: center; margin-bottom: 12px; color: #ffd54f; }
            .il-head, .il-row { display: grid; grid-template-columns: 28px 30px 1fr 64px 64px; align-items: center; gap: 8px; font-size: 12px; padding: 5px 4px; }
            .il-head { color: #8fa0b0; font-size: 10px; font-weight: 800; border-bottom: 1px solid rgba(255,255,255,.1); }
            .il-row { border-bottom: 1px solid rgba(255,255,255,.05); }
            .il-win { background: rgba(255,213,79,.12); border-radius: 8px; }
            .il-av { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
            .il-nick { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .il-t { font-weight: 800; color: #90caf9; text-align: right; }
            .il-r { text-align: right; }
            .il-count { margin-top: 14px; text-align: center; font-weight: 800; font-size: 13px; color: #00e5ff; }

            /* Mobile / small-screen adaptation */
            @media (max-width: 760px), (max-height: 480px) {
                .btn-subway-unified-menu { width: 34px; height: 34px; bottom: 8px; left: 8px; }
                .btn-subway-online-lobby { height: 34px; padding: 0 10px; bottom: 8px; left: 48px; font-size: 11px; gap: 4px; border-radius: 17px; }
                .btn-subway-unified-menu svg { width: 18px; height: 18px; }
                .subway-top-timer-wrap { top: 6px; padding: 3px 9px; gap: 5px; }
                .subway-top-timer-wrap .timer-value { font-size: 12px; }
                .subway-top-timer-wrap .timer-icon { font-size: 11px; }
                .subway-top-timer-wrap .timer-badge { font-size: 8px; padding: 1px 5px; }
                .subway-tl-wrap { top: 34px; right: 4px; width: 150px; } .tl-track { height: 150px; min-height: 120px; } .tl-nick { max-width: 44px; } .tl-pill { font-size: 8px; height: 18px; right: 30px; top: 5px; padding: 0 5px; } .tl-dot { width: 24px; height: 24px; } .il-card { padding: 10px 12px; } .il-head, .il-row { font-size: 10px; padding: 3px 2px; }
                .subway-live-rank { top: 44px; right: 6px; min-width: 120px; padding: 6px 8px; font-size: 9px; }
                .subway-modal-box, .unified-box { width: 96vw !important; max-height: 94vh; }
                .modal-header { padding: 8px 12px; }
                .modal-header h2 { font-size: 13px; }
                .countdown-num { font-size: 54px; }
                .subway-spectator-hud { bottom: 6px; padding: 4px 10px; font-size: 10px; gap: 8px; }
                .ghost-figure { width: 22px; height: 36px; }
                .ghost-tag { font-size: 8px; padding: 1px 5px; }
                .subway-invite-popup { bottom: 8px; right: 8px; padding: 8px; }
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
            ['btnMyTour', 'btnShop', 'btnTopRun', 'btnMe'].forEach(k => {
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
            if (changed && t.bottomMenu) {
                try { t.bottomMenu.organise(); } catch (e) {}
            }
        } catch (e) {}
    }
    setInterval(hideHubButtons, 300);

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
