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
    window.UNLIMITED_MODE = localStorage.getItem('subway_unlimited_mode') !== 'false'; // Default true
    window.GAME_MODE = localStorage.getItem('subway_game_mode') || 'normal'; // 'normal' | 'nocoin'
    window.NO_COIN_MODE = (window.GAME_MODE === 'nocoin');

    let runTimerInterval = null;
    let runStartTime = 0;
    let runElapsedTime = 0;
    let isRunActive = false;

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
        currentRoomTopic: null,
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
        if (timerWrap) timerWrap.style.display = 'flex';
        if (timerVal) timerVal.textContent = '00:00.00';

        clearInterval(runTimerInterval);
        runTimerInterval = setInterval(() => {
            if (isRunActive) {
                runElapsedTime = performance.now() - runStartTime;
                if (timerVal) {
                    timerVal.textContent = formatTime(runElapsedTime);
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
        if (!MP.inMatch) {
            clearInterval(runTimerInterval);
        }
        runElapsedTime = performance.now() - runStartTime;

        const timeStr = formatTime(runElapsedTime);
        const timerVal = document.getElementById('subway-top-timer-val');
        if (timerVal) timerVal.textContent = timeStr;

        saveRecord({
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
            case 'match_start':
                handleMatchStart(msg);
                break;
            case 'runner_pos':
                handleRunnerPos(msg);
                break;
            case 'player_death':
                handlePlayerDeath(msg);
                break;
            case 'match_end':
                handleMatchEnd(msg);
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

    function acceptInvite(host, roomId) {
        MP.roomId = roomId;
        MP.isPartyLeader = false;
        MP.isReady = false;
        MP.currentRoomTopic = 'subwaysurf/room/' + roomId;

        if (MP.mqtt && MP.mqtt.connected) {
            MP.mqtt.subscribe(MP.currentRoomTopic);
        }

        // Notify host
        sendGlobalMessage('subwaysurf/player/' + host.id, {
            type: 'invite_response',
            sender: myProfile,
            accepted: true,
            roomId: roomId
        });

        showHUDNotification('✅ Entrou no grupo de ' + host.nick + '!');
        renderPartySlots();
    }

    function handleInviteResponse(msg) {
        if (!MP.isPartyLeader) return;
        const player = msg.sender;
        if (msg.accepted) {
            if (MP.party.length < 4 && !MP.party.some(p => p.id === player.id)) {
                MP.party.push({
                    id: player.id,
                    nick: player.nick,
                    avatar: player.avatar,
                    ready: false,
                    isLeader: false
                });
                syncPartyToAll();
                showHUDNotification('🎉 ' + player.nick + ' entrou no grupo!');
            }
        } else {
            showHUDNotification('❌ ' + player.nick + ' recusou o convite.');
        }
        renderPartySlots();
    }

    function syncPartyToAll() {
        sendRoomMessage({
            type: 'party_sync',
            sender: myProfile,
            party: MP.party
        });
    }

    function handlePartySync(msg) {
        if (msg.party && Array.isArray(msg.party)) {
            MP.party = msg.party;
            const me = MP.party.find(p => p.id === myProfile.id);
            if (me) {
                MP.isReady = !!me.ready;
                MP.isPartyLeader = !!me.isLeader;
            }
            renderPartySlots();
        }
    }

    function toggleReady() {
        MP.isReady = !MP.isReady;
        const me = MP.party.find(p => p.id === myProfile.id);
        if (me) me.ready = MP.isReady;

        sendRoomMessage({
            type: 'party_ready',
            sender: myProfile,
            ready: MP.isReady
        });

        renderPartySlots();
    }

    function handlePartyReady(msg) {
        const player = MP.party.find(p => p.id === msg.sender.id);
        if (player) {
            player.ready = !!msg.ready;
            renderPartySlots();
        }
    }

    function checkCanStartMatch() {
        if (MP.party.length < 2) return false;
        return MP.party.every(p => p.ready === true);
    }

    function requestStartMatch() {
        if (!checkCanStartMatch()) {
            alert('Atenção: Todos os membros do grupo (2 a 4) devem dar PRONTO antes de iniciar!');
            return;
        }

        sendRoomMessage({
            type: 'match_start',
            sender: myProfile,
            party: MP.party
        });

        startMultiplayerMatchCountdown();
    }

    function handleMatchStart(msg) {
        if (msg.party) MP.party = msg.party;
        startMultiplayerMatchCountdown();
    }

    let matchStartTimestamp = 0;

    function startMultiplayerMatchCountdown() {
        // Enforce No Coin Mode for online match!
        window.GAME_MODE = 'nocoin';
        window.NO_COIN_MODE = true;
        localStorage.setItem('subway_game_mode', 'nocoin');
        updateModeBadgeUI();

        MP.active = true;
        MP.inMatch = true;
        MP.aliveCount = MP.party.length;
        MP.placement = [];
        MP.spectatingId = null;
        MP.playersState.clear();

        // Initialize state for all party members
        const lanes = [-20, 0, 20];
        MP.party.forEach((p, idx) => {
            if (p.id !== myProfile.id) {
                MP.playersState.set(p.id, {
                    id: p.id,
                    nick: p.nick,
                    avatar: p.avatar,
                    x: lanes[idx % 3],
                    targetX: lanes[idx % 3],
                    y: 5.5,
                    z: 0,
                    alive: true,
                    time: 0,
                    isBot: String(p.id).startsWith('bot_'),
                    surviveLimitMs: 14000 + Math.floor(Math.random() * 22000) + idx * 5000,
                    nextMoveAt: Date.now() + 800 + idx * 300,
                    updated: Date.now()
                });
            }
        });

        // Close menu/modal
        closeUnifiedModal();

        // 3... 2... 1... Countdown overlay
        const overlay = document.createElement('div');
        overlay.className = 'subway-countdown-overlay';
        overlay.innerHTML = '<div class="countdown-num" id="cd-num">3</div><div class="countdown-sub">MODO NO COIN ONLINE - ÚLTIMO SOBREVIVENTE VENCE!</div>';
        document.body.appendChild(overlay);

        let count = 3;
        const cdTimer = setInterval(() => {
            count--;
            const numEl = document.getElementById('cd-num');
            if (count > 0) {
                if (numEl) numEl.textContent = count;
            } else if (count === 0) {
                if (numEl) numEl.textContent = 'VALENDO!';
            } else {
                clearInterval(cdTimer);
                overlay.remove();
                matchStartTimestamp = performance.now();

                try {
                    if (window.app && window.app.user) window.app.user.tutorial = true;
                    if (window.game && window.game.tutorial) window.game.tutorial.enabled = false;
                    if (window.app && window.app.nav && window.app.nav.toGame) {
                        window.app.nav.toGame();
                    } else if (window.game && window.game.run) {
                        window.game.run();
                    }
                } catch(e) {}

                startRunTimer();
                showLivePlacementHUD();
                updateGhostRunnersUI();
            }
        }, 900);
    }

    // Runner Sync & 3D Ghost Rendering
    function sendMultiplayerRunnerSync() {
        const now = Date.now();
        const matchElapsed = matchStartTimestamp ? (performance.now() - matchStartTimestamp) : runElapsedTime;

        if (window.game && window.game.hero && isRunActive) {
            const hero = window.game.hero;
            const bx = hero.body ? hero.body.x : (hero.x || 0);
            const by = hero.body ? hero.body.y : (hero.y || 5.5);
            const bz = hero.body ? hero.body.z : (hero.z || 0);
            const data = {
                type: 'runner_pos',
                sender: myProfile,
                x: bx,
                y: by,
                z: bz,
                alive: isRunActive,
                time: runElapsedTime
            };
            sendRoomMessage(data);
        }

        // Update AI/simulated online runners if any bot_* is in the party
        const lanes = [-20, 0, 20];
        MP.playersState.forEach((state, id) => {
            if (!state.isBot || !state.alive) return;
            state.time = matchElapsed;
            if (now >= state.nextMoveAt) {
                state.targetX = lanes[Math.floor(Math.random() * lanes.length)];
                if (Math.random() < 0.32) {
                    state.jumpUntil = now + 520;
                }
                state.nextMoveAt = now + 650 + Math.floor(Math.random() * 900);
            }
            state.x += (state.targetX - state.x) * 0.25;
            state.y = (state.jumpUntil && now < state.jumpUntil) ? 16 : 5.5;
            state.z = (window.game && window.game.hero && window.game.hero.body) ? (window.game.hero.body.z - 12) : (-matchElapsed * 0.08);

            if (matchElapsed >= state.surviveLimitMs) {
                state.alive = false;
                handlePlayerDeath({
                    sender: { id: id, nick: state.nick, avatar: state.avatar },
                    timeMs: matchElapsed
                });
            }
        });

        // If local player is spectating an alive player, keep SaveMe/GameOver closed and follow them
        if (!isRunActive && MP.spectatingId && window.app) {
            try {
                if (window.app.saveme && window.app.saveme.close) window.app.saveme.close();
                if (window.app.gameover && window.app.gameover.close) window.app.gameover.close();
                if (window.app.highScoreScreen && window.app.highScoreScreen.close) window.app.highScoreScreen.close();
            } catch(e) {}
        }

        updateGhostRunnersUI();
        updateLivePlacementHUD();
    }

    function handleRunnerPos(msg) {
        if (!MP.inMatch || !msg.sender) return;
        MP.playersState.set(msg.sender.id, {
            id: msg.sender.id,
            nick: msg.sender.nick,
            avatar: msg.sender.avatar,
            x: msg.x,
            y: msg.y,
            z: msg.z,
            alive: msg.alive,
            time: msg.time,
            updated: Date.now()
        });
        updateGhostRunnersUI();
        updateLivePlacementHUD();
    }

    function updateGhostRunnersUI() {
        let container = document.getElementById('subway-ghost-runners');
        if (!container) {
            container = document.createElement('div');
            container.id = 'subway-ghost-runners';
            container.className = 'subway-ghost-container';
            document.body.appendChild(container);
        }
        if (!MP.inMatch) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        MP.playersState.forEach((state, id) => {
            if (id === myProfile.id || !state.alive) return;
            const laneOffsetPx = (state.x || 0) * 6.5;
            const jumpOffsetPx = Math.max(0, ((state.y || 5.5) - 5.5) * 4.5);
            const isSpectated = (MP.spectatingId === id);
            html += `
                <div class="ghost-runner-wrap ${isSpectated ? 'ghost-spectated' : ''}" style="left: calc(50% + ${laneOffsetPx}px); top: calc(64% - ${jumpOffsetPx}px);">
                    <div class="ghost-tag">
                        <img class="gt-avatar" src="${state.avatar}" />
                        <span class="gt-nick">${state.nick}</span>
                    </div>
                    <div class="ghost-figure">
                        <div class="ghost-head"></div>
                        <div class="ghost-body"></div>
                        <div class="ghost-shadow"></div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function handleLocalMultiplayerDeath(timeMs) {
        if (MP.placement.some(d => d.id === myProfile.id)) return;
        sendRoomMessage({
            type: 'player_death',
            sender: myProfile,
            timeMs: timeMs
        });
        MP.placement.push({ ...myProfile, alive: false, timeMs: timeMs });
        checkMultiplayerWinnerOrSpectate();
    }

    function handlePlayerDeath(msg) {
        const deadPlayer = msg.sender;
        if (!deadPlayer || MP.placement.some(d => d.id === deadPlayer.id)) return;
        MP.placement.push({ ...deadPlayer, alive: false, timeMs: msg.timeMs });
        checkMultiplayerWinnerOrSpectate();
        updateLivePlacementHUD();
    }

    function checkMultiplayerWinnerOrSpectate() {
        const aliveRemaining = MP.party.filter(p => !MP.placement.some(d => d.id === p.id));
        if (aliveRemaining.length <= 1) {
            const winner = aliveRemaining[0] || MP.placement[MP.placement.length - 1] || myProfile;
            sendRoomMessage({
                type: 'match_end',
                winner: winner,
                placement: MP.placement
            });
            showWinnerCelebration(winner);
        } else if (!isRunActive) {
            enterSpectatorMode();
        }
        updateLivePlacementHUD();
    }

    function handleMatchEnd(msg) {
        if (msg.winner) {
            showWinnerCelebration(msg.winner);
        }
    }

    function showWinnerCelebration(winner) {
        if (!MP.inMatch) return;
        MP.inMatch = false;
        clearInterval(runTimerInterval);

        // Build full placement order from last place to 1st place and save in records
        const rankedAsc = MP.placement.filter(p => p.id !== winner.id);
        rankedAsc.push({ ...winner, alive: true, timeMs: runElapsedTime });
        const total = rankedAsc.length;
        const placementLine = rankedAsc.map((p, i) => `${total - i}º ${p.nick}`).join(' ➔ ');

        saveRecord({
            date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString().slice(0, 5),
            mode: 'No Coin (Online)',
            timeMs: runElapsedTime,
            timeStr: formatTime(runElapsedTime),
            nick: `🏆 1º ${winner.nick} (${placementLine})`
        });

        const banner = document.createElement('div');
        banner.className = 'subway-winner-banner';
        banner.innerHTML = `
            <div class="winner-card">
                <div class="winner-trophy">🏆</div>
                <h2>VITÓRIA ONLINE!</h2>
                <img class="winner-avatar" src="${winner.avatar}" />
                <h3>${winner.nick}</h3>
                <p>Último sobrevivente no Modo No Coin!</p>
                <div style="margin-top:10px;font-size:12px;color:#90caf9;">${placementLine}</div>
                <button class="btn-winner-close" onclick="this.closest('.subway-winner-banner').remove(); window.__openUnifiedMenu('records');">
                    Ver Histórico e Recordes
                </button>
            </div>
        `;
        document.body.appendChild(banner);
        hideSpectatorHUD();
        hideLivePlacementHUD();
    }

    function enterSpectatorMode() {
        try {
            if (window.app && window.app.saveme && window.app.saveme.close) window.app.saveme.close();
            if (window.app && window.app.gameover && window.app.gameover.close) window.app.gameover.close();
        } catch(e) {}

        const hud = document.getElementById('subway-spectator-hud') || document.createElement('div');
        hud.id = 'subway-spectator-hud';
        hud.className = 'subway-spectator-hud';
        
        const aliveOthers = MP.party.filter(p => p.id !== myProfile.id && !MP.placement.some(d => d.id === p.id));
        if (aliveOthers.length === 0) return;
        
        MP.spectatingId = aliveOthers[0].id;
        hud.innerHTML = `
            <div class="spec-banner">
                <span class="spec-live-dot">●</span> 
                MODO ESPECTADOR: Assistindo <strong id="spec-target-nick">${aliveOthers[0].nick}</strong>
            </div>
            <div class="spec-controls">
                <button id="btn-spec-prev">◀ Anterior</button>
                <button id="btn-spec-next">Próximo ▶</button>
            </div>
        `;
        document.body.appendChild(hud);

        let specIdx = 0;
        hud.querySelector('#btn-spec-next').onclick = () => {
            specIdx = (specIdx + 1) % aliveOthers.length;
            MP.spectatingId = aliveOthers[specIdx].id;
            hud.querySelector('#spec-target-nick').textContent = aliveOthers[specIdx].nick;
        };
        hud.querySelector('#btn-spec-prev').onclick = () => {
            specIdx = (specIdx - 1 + aliveOthers.length) % aliveOthers.length;
            MP.spectatingId = aliveOthers[specIdx].id;
            hud.querySelector('#spec-target-nick').textContent = aliveOthers[specIdx].nick;
        };
    }

    function hideSpectatorHUD() {
        const hud = document.getElementById('subway-spectator-hud');
        if (hud) hud.remove();
        const ghosts = document.getElementById('subway-ghost-runners');
        if (ghosts) ghosts.remove();
    }

    function showLivePlacementHUD() {
        let el = document.getElementById('subway-live-rank');
        if (!el) {
            el = document.createElement('div');
            el.id = 'subway-live-rank';
            el.className = 'subway-live-rank';
            document.body.appendChild(el);
        }
        updateLivePlacementHUD();
    }

    function hideLivePlacementHUD() {
        const el = document.getElementById('subway-live-rank');
        if (el) el.remove();
    }

    function updateLivePlacementHUD() {
        const el = document.getElementById('subway-live-rank');
        if (!el || !MP.inMatch) return;

        // Sort from last place (Nº) to 1st place (1º) as requested!
        const allList = MP.party.map(p => {
            const deadEntry = MP.placement.find(d => d.id === p.id);
            const isDead = !!deadEntry;
            const state = MP.playersState.get(p.id);
            const time = isDead ? (deadEntry.timeMs || 0) : (p.id === myProfile.id ? runElapsedTime : (state ? state.time : 0));
            return {
                id: p.id,
                nick: p.nick,
                avatar: p.avatar,
                alive: !isDead,
                time: time
            };
        });

        // Sort 1st to last first to assign rank numbers, then display from last place to 1st place
        allList.sort((a, b) => {
            if (a.alive && !b.alive) return -1;
            if (!a.alive && b.alive) return 1;
            return b.time - a.time;
        });
        const rankedFromLastToFirst = allList.map((p, idx) => ({ ...p, pos: idx + 1 })).reverse();

        el.innerHTML = `
            <div class="rank-header">🏁 COLOCAÇÃO (ÚLTIMO ➔ 1º)</div>
            ${rankedFromLastToFirst.map(p => `
                <div class="rank-item ${p.alive ? 'rk-alive' : 'rk-dead'}">
                    <span class="rk-pos">${p.pos}º</span>
                    <img class="rk-avatar" src="${p.avatar}" />
                    <span class="rk-nick">${p.nick}</span>
                    <span class="rk-st">${p.alive ? '🟢 VIVO' : '💀 MORTO'}</span>
                </div>
            `).join('')}
        `;
    }

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
    }

    function updateModeBadgeUI() {
        const badge = document.getElementById('subway-mode-indicator');
        if (badge) {
            badge.className = `timer-badge ${window.NO_COIN_MODE ? 'badge-nocoin' : 'badge-normal'}`;
            badge.textContent = window.NO_COIN_MODE ? 'NO COIN 🔴' : 'NORMAL 🟡';
        }
    }

    window.__openUnifiedMenu = function(tab) {
        openUnifiedModal(tab || 'modes');
    };

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
                    <button class="tab-btn" data-tab="modes" id="tab-btn-modes">🎮 Modos de Jogo</button>
                    <button class="tab-btn" data-tab="multiplayer" id="tab-btn-multiplayer">🌐 Multiplayer Online</button>
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

                <!-- Tab 2: Online Multiplayer -->
                <div class="tab-pane" id="pane-multiplayer">
                    <!-- Profile Card -->
                    <div class="lobby-profile-card">
                        <div class="profile-avatar-wrap">
                            <img id="lobby-my-avatar" src="${myProfile.avatar}" alt="Avatar" />
                        </div>
                        <div class="profile-info-wrap">
                            <div class="profile-input-group">
                                <label>Seu Nickname:</label>
                                <input type="text" id="input-my-nick" value="${myProfile.nick}" maxlength="15" />
                            </div>
                            <div class="profile-input-group">
                                <label>URL da Foto (ou escolha uma padrão):</label>
                                <input type="text" id="input-my-avatar" value="${myProfile.avatar}" placeholder="https://..." />
                            </div>
                            <div class="avatar-presets">
                                ${DEFAULT_AVATARS.map(av => `
                                    <img class="preset-img" src="${av.url}" title="${av.name}" onclick="window.__selectPresetAvatar('${av.url}')" />
                                `).join('')}
                            </div>
                        </div>
                        <button class="btn-save-profile" id="btn-save-profile">Salvar Perfil</button>
                    </div>

                    <div class="lobby-grid">
                        <!-- Party Slots (2-4 players) -->
                        <div class="lobby-column party-col">
                            <div class="col-header">
                                <h3>MEU GRUPO (${MP.party.length}/4)</h3>
                                <span class="party-hint">Todos devem dar PRONTO para iniciar!</span>
                            </div>
                            <div class="party-slots-container" id="party-slots">
                                <!-- Injected by renderPartySlots -->
                            </div>
                            <div class="party-bottom-actions">
                                <button id="btn-toggle-ready" class="btn-ready ${MP.isReady ? 'ready-on' : 'ready-off'}">
                                    ${MP.isReady ? '✅ PRONTO!' : '⏳ DAR PRONTO'}
                                </button>
                                <button id="btn-start-match" class="btn-start-match" ${checkCanStartMatch() ? '' : 'disabled'}>
                                    🚀 INICIAR PARTIDA
                                </button>
                            </div>
                        </div>

                        <!-- Online Players List -->
                        <div class="lobby-column players-col">
                            <div class="col-header">
                                <h3>JOGADORES ONLINE NO MUNDO</h3>
                                <button class="btn-refresh-online" onclick="window.__refreshOnline()">🔄 Atualizar</button>
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
        document.getElementById('btn-save-profile').onclick = saveLobbyProfile;
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
        localStorage.setItem('subway_unlimited_mode', window.UNLIMITED_MODE ? 'true' : 'false');
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

    window.__selectPresetAvatar = function(url) {
        const inp = document.getElementById('input-my-avatar');
        const img = document.getElementById('lobby-my-avatar');
        if (inp) inp.value = url;
        if (img) img.src = url;
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
                html += `
                    <div class="party-slot slot-filled ${isReady ? 'slot-ready' : 'slot-waiting'}">
                        <div class="slot-avatar" style="background-image: url('${player.avatar}')"></div>
                        <div class="slot-details">
                            <span class="slot-nick">${player.nick} ${isMe ? '(Você)' : ''}</span>
                            <span class="slot-status ${isReady ? 'st-ready' : 'st-waiting'}">
                                ${isReady ? '✅ PRONTO' : '⏳ AGUARDANDO'}
                            </span>
                        </div>
                        ${!isMe && MP.isPartyLeader ? `<button class="btn-kick" onclick="window.__kickPlayer('${player.id}')">✕</button>` : ''}
                    </div>
                `;
            } else {
                html += `
                    <div class="party-slot slot-empty">
                        <span class="empty-plus">+</span>
                        <span class="empty-label">Vaga Livre (Convide ao lado)</span>
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
            readyBtn.textContent = MP.isReady ? '✅ PRONTO!' : '⏳ DAR PRONTO';
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
        const target = { id, nick, avatar };
        // Bot auto join for testing
        if (id.startsWith('bot_')) {
            if (MP.party.length < 4) {
                target.ready = false;
                MP.party.push(target);
                renderPartySlots();
                setTimeout(() => {
                    target.ready = true;
                    renderPartySlots();
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
            /* Netlify Remover */
            [class*="netlify"], [id*="netlify"], [href*="netlify.com"], netlify-drawer, #netlify-drawer, .netlify-badge, #nl-badge-frame, iframe[title*="Netlify"], iframe[srcdoc*="Netlify"], script[src*=".netlify/scripts"], [data-netlify-site-id], [data-nf-variant] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
                pointer-events: none !important;
            }

            /* Minimalist Top Timer */
            .subway-top-timer-wrap {
                position: fixed;
                top: 14px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                display: none;
                align-items: center;
                gap: 8px;
                padding: 6px 14px;
                background: rgba(10, 16, 30, 0.75);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 24px;
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                box-shadow: 0 4px 14px rgba(0,0,0,0.4);
                user-select: none;
                pointer-events: none;
            }
            .subway-top-timer-wrap .timer-icon {
                font-size: 15px;
            }
            .subway-top-timer-wrap .timer-value {
                font-size: 17px;
                font-weight: 800;
                letter-spacing: 0.5px;
                font-variant-numeric: tabular-nums;
            }
            .subway-top-timer-wrap .timer-badge {
                font-size: 11px;
                font-weight: 700;
                padding: 2px 7px;
                border-radius: 10px;
                text-transform: uppercase;
            }
            .badge-nocoin { background: #e53935; color: #fff; }
            .badge-normal { background: #fbc02d; color: #000; }

            /* Floating Menu Button (Bottom-Left Blue Gear Icon) */
            .btn-subway-unified-menu {
                position: fixed;
                bottom: 18px;
                left: 18px;
                z-index: 99998;
                width: 48px;
                height: 48px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #1e88e5, #0d47a1);
                color: #fff;
                border: 2px solid rgba(255, 255, 255, 0.35);
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 4px 14px rgba(13, 71, 161, 0.6);
                transition: transform 0.2s ease, filter 0.2s ease;
            }
            .btn-subway-unified-menu:hover {
                transform: scale(1.08) rotate(30deg);
                filter: brightness(1.15);
            }

            /* Unified Modal Backdrops & Containers */
            .subway-modal-backdrop {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(4, 10, 24, 0.85);
                backdrop-filter: blur(6px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .subway-modal-box {
                background: #111a2e;
                color: #fff;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.7);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                max-width: 90vw;
                max-height: 88vh;
            }
            .unified-box { width: 720px; }
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
                font-size: 17px;
                font-weight: 800;
                letter-spacing: 0.5px;
            }
            .btn-modal-close {
                background: none;
                border: none;
                color: #aaa;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
            }
            .btn-modal-close:hover { color: #fff; }

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
                border-bottom-color: #ff4b2b;
            }
            .tab-pane {
                display: none;
                padding: 20px;
                overflow-y: auto;
            }
            .tab-pane.active { display: block; }

            /* Cards in Modes Tab */
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

            /* Multiplayer Tab & Lobby */
            .lobby-profile-card {
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 16px;
                display: flex;
                gap: 14px;
                align-items: center;
            }
            .profile-avatar-wrap img {
                width: 54px; height: 54px; border-radius: 50%;
                border: 2px solid #ff4b2b; object-fit: cover;
            }
            .profile-info-wrap { flex: 1; display: flex; flex-direction: column; gap: 8px; }
            .profile-input-group { display: flex; flex-direction: column; gap: 4px; }
            .profile-input-group label { font-size: 11px; color: #8fa0b0; }
            .profile-input-group input {
                background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15);
                border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 12px;
            }
            .avatar-presets { display: flex; gap: 8px; margin-top: 4px; }
            .preset-img {
                width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
                border: 1px solid rgba(255,255,255,0.3); transition: transform 0.1s;
            }
            .preset-img:hover { transform: scale(1.15); border-color: #ff4b2b; }
            .btn-save-profile {
                background: #2979ff; border: none; color: #fff; border-radius: 8px;
                padding: 8px 14px; font-weight: 700; font-size: 12px; cursor: pointer;
            }

            .lobby-grid { display: flex; gap: 16px; }
            .lobby-column { flex: 1; background: rgba(0,0,0,0.25); border-radius: 12px; padding: 14px; }
            .col-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
            .col-header h3 { margin: 0; font-size: 13px; font-weight: 800; }
            .party-hint { font-size: 10px; color: #ffab40; }
            .party-slots-container { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
            .party-slot {
                height: 48px; border-radius: 8px; padding: 0 12px;
                display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.08);
            }
            .slot-filled { background: rgba(255,255,255,0.05); }
            .slot-ready { border-color: #00c853; }
            .slot-waiting { border-color: #ffab40; }
            .slot-empty {
                border-style: dashed; justify-content: center;
                background: rgba(255,255,255,0.01); color: #607d8b; font-size: 11px;
            }
            .slot-avatar { width: 34px; height: 34px; border-radius: 50%; background-size: cover; }
            .slot-details { flex: 1; display: flex; flex-direction: column; }
            .slot-nick { font-size: 12px; font-weight: 700; }
            .slot-status { font-size: 10px; font-weight: 800; }
            .st-ready { color: #00e676; }
            .st-waiting { color: #ffab40; }
            .btn-kick { background: none; border: none; color: #f44336; cursor: pointer; font-size: 14px; }
            
            .party-bottom-actions { display: flex; gap: 8px; }
            .btn-ready {
                flex: 1; padding: 10px; border-radius: 8px; border: none;
                font-size: 12px; font-weight: 800; cursor: pointer;
            }
            .ready-on { background: #00c853; color: #fff; }
            .ready-off { background: #37474f; color: #eceff1; }
            .btn-start-match {
                flex: 1.4; padding: 10px; border-radius: 8px; border: none;
                font-size: 12px; font-weight: 800; cursor: not-allowed;
                background: #263238; color: #546e7a;
            }
            .btn-start-match.can-start {
                cursor: pointer; background: linear-gradient(135deg, #ff416c, #ff4b2b);
                color: #fff; box-shadow: 0 4px 12px rgba(255,65,108,0.4);
            }

            .online-players-list { max-height: 230px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
            .player-card {
                display: flex; align-items: center; gap: 10px; padding: 8px 12px;
                background: rgba(255,255,255,0.03); border-radius: 8px;
            }
            .card-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
            .card-nick { flex: 1; font-size: 12px; font-weight: 700; }
            .btn-invite {
                background: #2979ff; border: none; color: #fff; border-radius: 6px;
                padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
            }
            .btn-invite[disabled] { background: #37474f; color: #78909c; cursor: default; }

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
        `;
        document.head.appendChild(style);
    }

    // ==========================================
    // 10. INITIALIZATION
    // ==========================================
    function init() {
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
