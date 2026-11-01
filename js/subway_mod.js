/**
 * Subway Surfers Ultra Mod & Online Multiplayer System
 * Features:
 * - 100% Unlocked Characters, Boards, Outfits, Max Upgrades, 999M Coins & Keys
 * - Free Shop (Zero Cost)
 * - Unlimited FPS & Performance Engine
 * - No Coin Mode (Instant Death on Red Coins, Identical Hitbox)
 * - Top Stopwatch Timer & Mode Badge
 * - Records & Run History
 * - Online Multiplayer (No Coin Only, 2-4 Players, Ready System, Ghost Transparency, Live Placements, Spectator Mode)
 */
(function() {
    'use strict';

    // ==========================================
    // 1. DATA & CONSTANTS
    // ==========================================
    const ALL_CHARACTERS = [
        'jake', 'tricky', 'fresh', 'spike', 'yutani', 'frank', 'frizzy', 
        'king', 'lucy', 'ninja', 'tagbot', 'tasha', 'zoe', 'brody'
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
        { id: 'jake', name: 'Jake', url: 'assets/images/app-icon-114.png' },
        { id: 'tricky', name: 'Tricky', url: 'assets/preload/splash.png' },
        { id: 'lucy', name: 'Lucy', url: 'assets/images/app-icon-72.png' },
        { id: 'ninja', name: 'Ninja', url: 'assets/images/app-icon-57.png' },
        { id: 'king', name: 'King', url: 'assets/images/app-icon-16.png' }
    ];

    // ==========================================
    // 2. STATE MANAGEMENT
    // ==========================================
    window.GAME_MODE = localStorage.getItem('subway_game_mode') || 'normal'; // 'normal' | 'nocoin'
    window.NO_COIN_MODE = window.GAME_MODE === 'nocoin';

    let runTimerInterval = null;
    let runStartTime = 0;
    let runElapsedTime = 0;
    let isRunActive = false;

    // Local profile
    let myProfile = JSON.parse(localStorage.getItem('subway_surfers_profile') || 'null');
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
        peer: null,
        peerId: null,
        broadcast: null,
        connections: new Map(), // peerId -> DataConnection
        party: [myProfile],     // Array of player objects { id, nick, avatar, ready, isLeader }
        isPartyLeader: true,
        isReady: false,
        inMatch: false,
        playersState: new Map(), // id -> { x, y, lane, state, alive, time }
        placement: [],          // [{ id, nick, avatar, alive, time }]
        spectatingId: null,
        aliveCount: 0
    };

    // ==========================================
    // 3. UNLOCK EVERYTHING & FREE SHOP
    // ==========================================
    function preSeedLocalStorage() {
        try {
            // shopSettings
            const shopSettings = {
                purchased: {
                    characters: ALL_CHARACTERS,
                    boards: ALL_BOARDS,
                    outfits: ALL_OUTFITS,
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

            // gameSettings
            const existingGameSettings = JSON.parse(localStorage.getItem('gameSettings') || '{}');
            existingGameSettings.currencies = { coins: 999999999, keys: 999999999 };
            existingGameSettings.highscore = Math.max(existingGameSettings.highscore || 0, 9999999);
            localStorage.setItem('gameSettings', JSON.stringify(existingGameSettings));
        } catch(e) {
            console.warn('Storage pre-seed error:', e);
        }
    }
    preSeedLocalStorage();

    function applyUnlock(user) {
        if (!user) return;
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
                if (user.shopSettings.save) user.shopSettings.save();
            }
            if (user.save) user.save();
        } catch(e) {
            console.warn('applyUnlock error:', e);
        }
    }

    // Keep currencies & unlocks active
    window.__onAppCreated = function(app) {
        if (app && app.user) {
            applyUnlock(app.user);
            setInterval(() => applyUnlock(app.user), 1000);
        }
    };

    // ==========================================
    // 4. UNLIMITED FPS & PERFORMANCE ENGINE
    // ==========================================
    function setupPerformanceEngine() {
        // Remove frame caps in Pixi Ticker
        const tickerHook = setInterval(() => {
            if (window.PIXI && window.PIXI.Ticker) {
                if (window.PIXI.Ticker.shared) {
                    window.PIXI.Ticker.shared.maxFPS = 0;
                    window.PIXI.Ticker.shared.minFPS = 10;
                }
                if (window.PIXI.Ticker.system) {
                    window.PIXI.Ticker.system.maxFPS = 0;
                    window.PIXI.Ticker.system.minFPS = 10;
                }
            }
            if (window.game) {
                clearInterval(tickerHook);
            }
        }, 50);

        // Discard ad blockers & commercial delays
        if (window.PokiSDK) {
            window.PokiSDK.commercialBreak = () => Promise.resolve();
            window.PokiSDK.rewardedBreak = () => Promise.resolve();
            window.PokiSDK.displayAd = () => {};
            window.PokiSDK.destroyAd = () => {};
        }
    }
    setupPerformanceEngine();

    // ==========================================
    // 5. NO COIN MODE & RED COIN STYLING
    // ==========================================
    function makeEntityRed(ent, isRed) {
        if (!ent) return;
        const colorHex = isRed ? 0xff1e1e : 0xffffff;
        const colorArr = isRed ? [1.0, 0.12, 0.12, 1.0] : [1.0, 1.0, 1.0, 1.0];

        try {
            if (ent.material) {
                ent.material.color = colorHex;
                if (ent.material.tint !== undefined) ent.material.tint = colorHex;
                if (ent.material.uniforms) {
                    if (ent.material.uniforms.uColor) ent.material.uniforms.uColor.value = colorArr;
                    if (ent.material.uniforms.color) ent.material.uniforms.color.value = colorArr;
                    if (ent.material.uniforms.tint) ent.material.uniforms.tint.value = colorArr;
                }
            }
            if (ent.view3d && ent.view3d.material) {
                ent.view3d.material.color = colorHex;
                if (ent.view3d.material.tint !== undefined) ent.view3d.material.tint = colorHex;
                if (ent.view3d.material.uniforms) {
                    if (ent.view3d.material.uniforms.uColor) ent.view3d.material.uniforms.uColor.value = colorArr;
                    if (ent.view3d.material.uniforms.color) ent.view3d.material.uniforms.color.value = colorArr;
                    if (ent.view3d.material.uniforms.tint) ent.view3d.material.uniforms.tint.value = colorArr;
                }
            }
            if (ent.tint !== undefined) ent.tint = colorHex;
            if (ent.children && ent.children.length) {
                for (let i = 0; i < ent.children.length; i++) {
                    makeEntityRed(ent.children[i], isRed);
                }
            }
        } catch(e) {}
    }

    // Called on every coin spawn/awake from patched dependencies.bundle.js
    window.__onCoinAwake = function(coin) {
        if (!coin || !coin.model) return;
        // Hitbox is strictly preserved (body.width=5, body.height=5, body.depth=5)
        const isNoCoin = !!window.NO_COIN_MODE;
        makeEntityRed(coin.model, isNoCoin);
        if (coin.shine && isNoCoin) {
            makeEntityRed(coin.shine, true);
        }
    };

    // Called on coin pickup collision when NO_COIN_MODE is active
    window.__onNoCoinCollect = function(coin) {
        console.log('[NO COIN MODE] Coin touched! Instant death!');
        showDeathEffect('💀 ENCOSTOU NA MOEDA VERMELHA!');
        if (coin && coin.game) {
            if (coin.game.sfx && coin.game.sfx.play) {
                coin.game.sfx.play('hero-crash', { volume: 1.0 });
            }
            if (coin.game.gameover) {
                coin.game.gameover();
            } else if (coin.game.hero && coin.game.hero.die) {
                coin.game.hero.die();
            }
        }
    };

    function showDeathEffect(msg) {
        const el = document.createElement('div');
        el.className = 'subway-death-banner';
        el.innerHTML = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    // ==========================================
    // 6. TOP TIMER & RECORDS SYSTEM
    // ==========================================
    function formatTime(ms) {
        const totalSec = Math.floor(ms / 1000);
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const hundredths = Math.floor((ms % 1000) / 10);
        const mm = String(mins).padStart(2, '0');
        const ss = String(secs).padStart(2, '0');
        const hh = String(hundredths).padStart(2, '0');
        return `${mm}:${ss}.${hh}`;
    }

    function startRunTimer() {
        if (isRunActive) return;
        isRunActive = true;
        runStartTime = performance.now();
        runElapsedTime = 0;

        const timerText = document.getElementById('subway-top-timer-val');
        if (timerText) timerText.textContent = '00:00.00';

        clearInterval(runTimerInterval);
        runTimerInterval = setInterval(() => {
            if (!isRunActive) return;
            runElapsedTime = performance.now() - runStartTime;
            if (timerText) {
                timerText.textContent = formatTime(runElapsedTime);
            }
            // Send multiplayer position sync
            if (MP.active && MP.inMatch) {
                sendMultiplayerSync();
            }
        }, 30);
    }

    function stopRunTimer() {
        if (!isRunActive) return;
        isRunActive = false;
        clearInterval(runTimerInterval);
        runElapsedTime = performance.now() - runStartTime;

        const timeStr = formatTime(runElapsedTime);
        const timerText = document.getElementById('subway-top-timer-val');
        if (timerText) timerText.textContent = timeStr;

        // Save local record
        saveRecord({
            date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString().slice(0, 5),
            mode: window.NO_COIN_MODE ? 'No Coin' : 'Normal',
            timeMs: runElapsedTime,
            timeStr: timeStr,
            nick: myProfile.nick
        });

        // Multiplayer death handling
        if (MP.active && MP.inMatch) {
            handleLocalMultiplayerDeath(runElapsedTime);
        }
    }

    function saveRecord(record) {
        try {
            const history = JSON.parse(localStorage.getItem('subway_surfers_records') || '[]');
            history.unshift(record);
            if (history.length > 50) history.pop();
            localStorage.setItem('subway_surfers_records', JSON.stringify(history));
        } catch(e) {}
    }

    // Wrap game.run and game.gameover when game instance becomes available
    const gameHookInterval = setInterval(() => {
        if (window.game) {
            clearInterval(gameHookInterval);

            const origRun = window.game.run;
            window.game.run = function() {
                startRunTimer();
                return origRun.apply(this, arguments);
            };

            const origGameover = window.game.gameover;
            window.game.gameover = function() {
                stopRunTimer();
                return origGameover.apply(this, arguments);
            };

            if (window.game.onRun && window.game.onRun.add) {
                window.game.onRun.add(startRunTimer);
            }
            if (window.game.onGameover && window.game.onGameover.add) {
                window.game.onGameover.add(stopRunTimer);
            }
        }
    }, 100);

    // ==========================================
    // 7. ONLINE MULTIPLAYER ENGINE (PeerJS + BroadcastChannel)
    // ==========================================
    function initMultiplayerNetworking() {
        if (MP.broadcast) return;

        // 1. BroadcastChannel for local/multi-tab testing
        try {
            MP.broadcast = new BroadcastChannel('subway_surfers_mp');
            MP.broadcast.onmessage = (e) => handleNetworkMessage(e.data);
        } catch(e) {
            console.warn('BroadcastChannel not supported', e);
        }

        // 2. PeerJS for internet/cross-device multiplayer
        if (window.Peer) {
            try {
                MP.peer = new Peer(myProfile.id, {
                    debug: 1,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    }
                });

                MP.peer.on('open', (id) => {
                    MP.peerId = id;
                    broadcastPresence();
                });

                MP.peer.on('connection', (conn) => {
                    setupPeerConnection(conn);
                });

                MP.peer.on('error', (err) => {
                    console.warn('Peer error:', err);
                });
            } catch(e) {
                console.warn('Peer init error:', e);
            }
        }

        // Broadcast presence periodically
        setInterval(broadcastPresence, 3000);
    }

    function setupPeerConnection(conn) {
        MP.connections.set(conn.peer, conn);
        conn.on('data', (data) => handleNetworkMessage(data));
        conn.on('close', () => {
            MP.connections.delete(conn.peer);
            removePlayerFromParty(conn.peer);
        });
    }

    function broadcastPresence() {
        const msg = {
            type: 'presence',
            sender: myProfile,
            inParty: MP.party.length > 1,
            partySize: MP.party.length
        };
        sendNetworkMessage(msg);
    }

    function sendNetworkMessage(msg) {
        // Send via BroadcastChannel
        if (MP.broadcast) {
            try { MP.broadcast.postMessage(msg); } catch(e) {}
        }
        // Send via PeerJS connections
        MP.connections.forEach(conn => {
            if (conn && conn.open) {
                try { conn.send(msg); } catch(e) {}
            }
        });
    }

    const onlinePlayersRegistry = new Map(); // id -> { profile, lastSeen }

    function handleNetworkMessage(msg) {
        if (!msg || !msg.type || msg.sender?.id === myProfile.id) return;

        switch(msg.type) {
            case 'presence':
                onlinePlayersRegistry.set(msg.sender.id, {
                    profile: msg.sender,
                    lastSeen: Date.now(),
                    inParty: msg.inParty
                });
                renderOnlinePlayersList();
                break;

            case 'invite':
                if (msg.targetId === myProfile.id) {
                    showInviteNotification(msg.sender, msg.party);
                }
                break;

            case 'party_sync':
                // Update party members & ready state
                if (msg.party && msg.party.some(p => p.id === myProfile.id)) {
                    MP.party = msg.party;
                    renderPartySlots();
                }
                break;

            case 'ready_change':
                updatePlayerReady(msg.sender.id, msg.ready);
                break;

            case 'match_start':
                if (MP.party.some(p => p.id === myProfile.id)) {
                    startMultiplayerMatchCountdown();
                }
                break;

            case 'player_sync':
                if (MP.inMatch && msg.sender) {
                    MP.playersState.set(msg.sender.id, msg.data);
                    updateGhostPlayer(msg.sender, msg.data);
                }
                break;

            case 'player_death':
                if (MP.inMatch && msg.sender) {
                    handleRemotePlayerDeath(msg.sender, msg.timeMs);
                }
                break;
        }
    }

    function showInviteNotification(sender, party) {
        const notif = document.createElement('div');
        notif.className = 'subway-invite-toast';
        notif.innerHTML = `
            <div class="toast-avatar" style="background-image: url('${sender.avatar}')"></div>
            <div class="toast-info">
                <strong>${sender.nick}</strong> convidou você para o grupo!
            </div>
            <div class="toast-actions">
                <button class="btn-toast-accept" id="toast-accept-btn">Aceitar</button>
                <button class="btn-toast-decline" id="toast-decline-btn">Recusar</button>
            </div>
        `;
        document.body.appendChild(notif);

        document.getElementById('toast-accept-btn').onclick = () => {
            notif.remove();
            joinParty(party, sender);
        };
        document.getElementById('toast-decline-btn').onclick = () => {
            notif.remove();
        };
        setTimeout(() => notif.remove(), 8000);
    }

    function joinParty(party, leader) {
        // Connect to leader peer if using PeerJS
        if (MP.peer && leader.id && !MP.connections.has(leader.id)) {
            const conn = MP.peer.connect(leader.id);
            setupPeerConnection(conn);
        }

        // Add self to party if slots available (< 4)
        if (party.length < 4) {
            myProfile.ready = false;
            party.push(myProfile);
            MP.party = party;
            MP.isPartyLeader = false;
            MP.isReady = false;

            sendNetworkMessage({
                type: 'party_sync',
                sender: myProfile,
                party: MP.party
            });

            openMultiplayerLobby();
            renderPartySlots();
        }
    }

    function invitePlayer(targetProfile) {
        if (MP.party.length >= 4) {
            alert('O grupo já está cheio (máximo 4 jogadores)!');
            return;
        }
        // Connect to peer
        if (MP.peer && targetProfile.id && !MP.connections.has(targetProfile.id)) {
            const conn = MP.peer.connect(targetProfile.id);
            setupPeerConnection(conn);
        }

        sendNetworkMessage({
            type: 'invite',
            sender: myProfile,
            targetId: targetProfile.id,
            party: MP.party
        });

        alert(`Convite enviado para ${targetProfile.nick}!`);
    }

    function toggleReady() {
        MP.isReady = !MP.isReady;
        myProfile.ready = MP.isReady;

        // Update in party
        const me = MP.party.find(p => p.id === myProfile.id);
        if (me) me.ready = MP.isReady;

        sendNetworkMessage({
            type: 'party_sync',
            sender: myProfile,
            party: MP.party
        });

        renderPartySlots();
    }

    function updatePlayerReady(playerId, isReady) {
        const player = MP.party.find(p => p.id === playerId);
        if (player) {
            player.ready = isReady;
            renderPartySlots();
        }
    }

    function removePlayerFromParty(playerId) {
        MP.party = MP.party.filter(p => p.id !== playerId);
        if (MP.party.length === 1) {
            MP.isPartyLeader = true;
        }
        renderPartySlots();
    }

    function checkCanStartMatch() {
        if (MP.party.length < 2) return false;
        // ALL players must be ready!
        return MP.party.every(p => p.ready === true);
    }

    function startMultiplayerMatchCountdown() {
        // Enforce No Coin Mode for online match!
        window.GAME_MODE = 'nocoin';
        window.NO_COIN_MODE = true;
        localStorage.setItem('subway_game_mode', 'nocoin');
        updateModeBadgeUI();

        MP.inMatch = true;
        MP.aliveCount = MP.party.length;
        MP.placement = [];
        MP.spectatingId = null;

        // Close lobby overlay
        closeMultiplayerLobby();

        // Show countdown banner
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
                // Start game run!
                if (window.game && window.game.run) {
                    window.game.run();
                }
                showLivePlacementHUD();
            }
        }, 1000);
    }

    function sendMultiplayerSync() {
        if (!window.game || !window.game.hero) return;
        const hero = window.game.hero;
        const pos = hero.position || { x: 0, y: 0, z: 0 };
        const data = {
            lane: hero.targetLane || 0,
            x: pos.x || 0,
            y: pos.y || 0,
            z: pos.z || 0,
            state: hero.state || 'run',
            alive: isRunActive,
            timeMs: runElapsedTime
        };

        sendNetworkMessage({
            type: 'player_sync',
            sender: myProfile,
            data: data
        });

        // Update placement
        updateLiveLeaderboard();
    }

    // ==========================================
    // 8. GHOST PLAYERS & TRANSPARENCY RENDERING
    // ==========================================
    const ghostElements = new Map(); // id -> DOMElement

    function updateGhostPlayer(sender, data) {
        if (sender.id === myProfile.id) return;

        let ghost = ghostElements.get(sender.id);
        if (!ghost) {
            ghost = document.createElement('div');
            ghost.className = 'subway-ghost-player';
            ghost.innerHTML = `
                <div class="ghost-tag">
                    <img class="ghost-tag-avatar" src="${sender.avatar}" />
                    <span class="ghost-tag-nick">${sender.nick}</span>
                </div>
                <div class="ghost-runner-body"></div>
            `;
            document.body.appendChild(ghost);
            ghostElements.set(sender.id, ghost);
        }

        if (!data.alive) {
            ghost.style.display = 'none';
            return;
        }

        ghost.style.display = 'block';

        // Map 3D lane & jump to screen coords
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const laneOffset = (data.lane || 0) * (screenW * 0.18);
        const jumpOffset = (data.y || 0) * 8;

        const posX = (screenW / 2) + laneOffset - 35;
        const posY = (screenH * 0.68) - jumpOffset;

        ghost.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;

        const tagEl = ghost.querySelector('.ghost-tag-nick');
        if (tagEl && tagEl.textContent !== sender.nick) {
            tagEl.textContent = sender.nick;
        }
    }

    function removeAllGhosts() {
        ghostElements.forEach(el => el.remove());
        ghostElements.clear();
    }

    // ==========================================
    // 9. PLACEMENT LEADERBOARD & SPECTATOR MODE
    // ==========================================
    function showLivePlacementHUD() {
        let hud = document.getElementById('subway-live-placement');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'subway-live-placement';
            hud.className = 'subway-live-placement-hud';
            document.body.appendChild(hud);
        }
        hud.style.display = 'block';
        updateLiveLeaderboard();
    }

    function updateLiveLeaderboard() {
        const hud = document.getElementById('subway-live-placement');
        if (!hud || !MP.inMatch) return;

        // Build list of all players with their status
        const list = MP.party.map(p => {
            const isMe = p.id === myProfile.id;
            const state = isMe ? { alive: isRunActive, timeMs: runElapsedTime } : (MP.playersState.get(p.id) || { alive: true, timeMs: runElapsedTime });
            return {
                id: p.id,
                nick: p.nick,
                avatar: p.avatar,
                alive: state.alive,
                timeMs: state.timeMs || 0
            };
        });

        // Sort: alive players first (higher survival time), then eliminated players (ordered by elimination time)
        list.sort((a, b) => {
            if (a.alive && !b.alive) return -1;
            if (!a.alive && b.alive) return 1;
            return b.timeMs - a.timeMs;
        });

        const ranks = ['🥇 1º', '🥈 2º', '🥉 3º', '4º'];
        let html = '<div class="placement-title">🏆 COLOCAÇÃO AO VIVO</div>';
        list.forEach((p, idx) => {
            const rank = ranks[idx] || `${idx + 1}º`;
            const statusClass = p.alive ? 'status-alive' : 'status-eliminated';
            const statusText = p.alive ? 'VIVO' : `ELIMINADO (${formatTime(p.timeMs)})`;
            html += `
                <div class="placement-row ${p.id === myProfile.id ? 'is-me' : ''}">
                    <span class="placement-rank">${rank}</span>
                    <img class="placement-avatar" src="${p.avatar}" />
                    <span class="placement-nick">${p.nick}</span>
                    <span class="placement-badge ${statusClass}">${statusText}</span>
                </div>
            `;
        });

        hud.innerHTML = html;
    }

    function handleLocalMultiplayerDeath(survivalTime) {
        sendNetworkMessage({
            type: 'player_death',
            sender: myProfile,
            timeMs: survivalTime
        });

        // Add self to elimination placement
        MP.placement.push({
            id: myProfile.id,
            nick: myProfile.nick,
            avatar: myProfile.avatar,
            timeMs: survivalTime,
            rank: MP.aliveCount
        });
        MP.aliveCount--;

        // Enter Spectator Mode
        activateSpectatorMode();
    }

    function handleRemotePlayerDeath(sender, timeMs) {
        const ghost = ghostElements.get(sender.id);
        if (ghost) ghost.style.display = 'none';

        MP.placement.push({
            id: sender.id,
            nick: sender.nick,
            avatar: sender.avatar,
            timeMs: timeMs,
            rank: MP.aliveCount
        });
        MP.aliveCount--;

        updateLiveLeaderboard();

        // Check if only 1 player remains -> Winner!
        if (MP.aliveCount <= 1) {
            concludeMultiplayerMatch();
        }
    }

    function activateSpectatorMode() {
        const specHUD = document.createElement('div');
        specHUD.id = 'subway-spectator-hud';
        specHUD.className = 'subway-spectator-hud';
        specHUD.innerHTML = `
            <div class="spec-banner">
                💀 VOCÊ FOI ELIMINADO! &nbsp;|&nbsp; <span>MODO ESPECTADOR</span>
            </div>
            <div class="spec-controls">
                <button id="spec-prev-btn" class="btn-spec">◀ Jogador Anterior</button>
                <span id="spec-current-target" class="spec-target-name">Assistindo sobreviventes</span>
                <button id="spec-next-btn" class="btn-spec">Próximo Jogador ▶</button>
            </div>
        `;
        document.body.appendChild(specHUD);

        document.getElementById('spec-prev-btn').onclick = () => cycleSpectator(-1);
        document.getElementById('spec-next-btn').onclick = () => cycleSpectator(1);
    }

    function cycleSpectator(dir) {
        const alivePlayers = MP.party.filter(p => {
            if (p.id === myProfile.id) return false;
            const st = MP.playersState.get(p.id);
            return st && st.alive;
        });

        if (alivePlayers.length === 0) return;

        let idx = alivePlayers.findIndex(p => p.id === MP.spectatingId);
        idx = (idx + dir + alivePlayers.length) % alivePlayers.length;
        MP.spectatingId = alivePlayers[idx].id;

        const targetEl = document.getElementById('spec-current-target');
        if (targetEl) targetEl.textContent = 'Assistindo: ' + alivePlayers[idx].nick;
    }

    function concludeMultiplayerMatch() {
        const specHUD = document.getElementById('subway-spectator-hud');
        if (specHUD) specHUD.remove();

        const placementHUD = document.getElementById('subway-live-placement');
        if (placementHUD) placementHUD.style.display = 'none';

        // Find winner (last alive player)
        let winner = MP.party.find(p => !MP.placement.some(d => d.id === p.id));
        if (!winner && MP.placement.length > 0) {
            winner = MP.placement[MP.placement.length - 1];
        }

        const winModal = document.createElement('div');
        winModal.className = 'subway-victory-modal';
        winModal.innerHTML = `
            <div class="victory-box">
                <div class="victory-crown">👑</div>
                <h1 class="victory-title">${winner ? winner.nick : 'Fim de Jogo'} VENCEU!</h1>
                <p class="victory-sub">Último sobrevivente no modo No Coin!</p>
                <div class="victory-table">
                    <h3>PLACAR FINAL</h3>
                    ${MP.party.map((p, i) => `
                        <div class="victory-row">
                            <span class="v-rank">${i === 0 ? '🏆 1º' : `${i + 1}º`}</span>
                            <img class="v-avatar" src="${p.avatar}" />
                            <span class="v-nick">${p.nick}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-victory-back" id="btn-victory-close">Voltar ao Lobby</button>
            </div>
        `;
        document.body.appendChild(winModal);

        document.getElementById('btn-victory-close').onclick = () => {
            winModal.remove();
            removeAllGhosts();
            MP.inMatch = false;
            MP.isReady = false;
            myProfile.ready = false;
            openMultiplayerLobby();
        };
    }

    // ==========================================
    // 10. UI & LOBBY SYSTEM
    // ==========================================
    function injectUI() {
        // Top HUD Bar with Timer, Mode Toggle, and Online Button
        const topHUD = document.createElement('div');
        topHUD.className = 'subway-top-hud';
        topHUD.innerHTML = `
            <div class="hud-left">
                <button id="btn-toggle-mode" class="subway-hud-btn mode-btn ${window.NO_COIN_MODE ? 'mode-nocoin' : 'mode-normal'}">
                    MODO: <span id="hud-mode-name">${window.NO_COIN_MODE ? 'NO COIN 🔴' : 'NORMAL 🟡'}</span>
                </button>
            </div>
            <div class="hud-center">
                <div class="subway-timer-display">
                    <span class="timer-icon">⏱️</span>
                    <span id="subway-top-timer-val">00:00.00</span>
                </div>
            </div>
            <div class="hud-right">
                <button id="btn-open-records" class="subway-hud-btn">📜 RECORDES</button>
                <button id="btn-open-multiplayer" class="subway-hud-btn btn-mp-glow">🌐 MODO ONLINE</button>
            </div>
        `;
        document.body.appendChild(topHUD);

        // Click handlers
        document.getElementById('btn-toggle-mode').onclick = toggleGameMode;
        document.getElementById('btn-open-records').onclick = openRecordsModal;
        document.getElementById('btn-open-multiplayer').onclick = openMultiplayerLobby;
    }

    function toggleGameMode() {
        if (MP.inMatch) {
            alert('Não é possível alterar o modo durante uma partida online!');
            return;
        }
        window.NO_COIN_MODE = !window.NO_COIN_MODE;
        window.GAME_MODE = window.NO_COIN_MODE ? 'nocoin' : 'normal';
        localStorage.setItem('subway_game_mode', window.GAME_MODE);
        updateModeBadgeUI();

        showDeathEffect(window.NO_COIN_MODE ? 'MODO NO COIN ATIVADO! 🔴 (Moedas vermelhas = morte instantânea)' : 'MODO NORMAL ATIVADO! 🟡');
    }

    function updateModeBadgeUI() {
        const btn = document.getElementById('btn-toggle-mode');
        const name = document.getElementById('hud-mode-name');
        if (btn && name) {
            btn.className = `subway-hud-btn mode-btn ${window.NO_COIN_MODE ? 'mode-nocoin' : 'mode-normal'}`;
            name.textContent = window.NO_COIN_MODE ? 'NO COIN 🔴' : 'NORMAL 🟡';
        }
    }

    function openRecordsModal() {
        const modal = document.createElement('div');
        modal.className = 'subway-modal-backdrop';
        modal.id = 'modal-records';

        const records = JSON.parse(localStorage.getItem('subway_surfers_records') || '[]');

        modal.innerHTML = `
            <div class="subway-modal-box">
                <div class="modal-header">
                    <h2>📜 HISTÓRICO DE RECORDES</h2>
                    <button class="btn-modal-close" onclick="document.getElementById('modal-records').remove()">✕</button>
                </div>
                <div class="records-filter">
                    <button class="btn-filter active" id="flt-all">Todos</button>
                    <button class="btn-filter" id="flt-nocoin">No Coin 🔴</button>
                    <button class="btn-filter" id="flt-normal">Normal 🟡</button>
                </div>
                <div class="records-list" id="records-table-body">
                    ${renderRecordsList(records, 'all')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('flt-all').onclick = (e) => setFilter(e, records, 'all');
        document.getElementById('flt-nocoin').onclick = (e) => setFilter(e, records, 'No Coin');
        document.getElementById('flt-normal').onclick = (e) => setFilter(e, records, 'Normal');
    }

    function setFilter(e, records, flt) {
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById('records-table-body').innerHTML = renderRecordsList(records, flt);
    }

    function renderRecordsList(records, filter) {
        const filtered = filter === 'all' ? records : records.filter(r => r.mode === filter);
        if (filtered.length === 0) {
            return '<div class="no-records">Nenhum recorde registrado ainda! Corra para pontuar!</div>';
        }
        return `
            <table class="records-table">
                <thead>
                    <tr>
                        <th>Modo</th>
                        <th>Tempo</th>
                        <th>Jogador</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(r => `
                        <tr>
                            <td><span class="badge-${r.mode === 'No Coin' ? 'nocoin' : 'normal'}">${r.mode}</span></td>
                            <td class="rec-time">${r.timeStr}</td>
                            <td>${r.nick || 'Surfer'}</td>
                            <td>${r.date}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Multiplayer Lobby Modal
    function openMultiplayerLobby() {
        initMultiplayerNetworking();
        MP.active = true;

        let modal = document.getElementById('modal-mp-lobby');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.className = 'subway-modal-backdrop';
        modal.id = 'modal-mp-lobby';

        modal.innerHTML = `
            <div class="subway-modal-box lobby-box">
                <div class="modal-header">
                    <h2>🌐 LOBBY MULTIPLAYER (NO COIN ONLY)</h2>
                    <button class="btn-modal-close" id="btn-close-lobby">✕</button>
                </div>

                <!-- Profile Customization -->
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
                            <label>URL da Foto de Perfil (ou escolha padrão):</label>
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
                            <h3>JOGADORES ONLINE</h3>
                            <button class="btn-refresh-online" onclick="window.__refreshOnline()">🔄 Atualizar</button>
                        </div>
                        <div class="online-players-list" id="online-players-list">
                            <!-- Injected by renderOnlinePlayersList -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-close-lobby').onclick = closeMultiplayerLobby;
        document.getElementById('btn-save-profile').onclick = saveLobbyProfile;
        document.getElementById('btn-toggle-ready').onclick = toggleReady;
        document.getElementById('btn-start-match').onclick = requestStartMatch;

        renderPartySlots();
        renderOnlinePlayersList();
    }

    window.__selectPresetAvatar = function(url) {
        document.getElementById('input-my-avatar').value = url;
        document.getElementById('lobby-my-avatar').src = url;
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

        // Update in party
        const me = MP.party.find(p => p.id === myProfile.id);
        if (me) {
            me.nick = myProfile.nick;
            me.avatar = myProfile.avatar;
        }
        renderPartySlots();
        broadcastPresence();
        alert('Perfil salvo com sucesso!');
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

        // Update Start Match button state
        const startBtn = document.getElementById('btn-start-match');
        if (startBtn) {
            const canStart = checkCanStartMatch();
            startBtn.disabled = !canStart;
            if (canStart) {
                startBtn.classList.add('can-start');
            } else {
                startBtn.classList.remove('can-start');
            }
        }

        // Update Ready button appearance
        const readyBtn = document.getElementById('btn-toggle-ready');
        if (readyBtn) {
            readyBtn.className = `btn-ready ${MP.isReady ? 'ready-on' : 'ready-off'}`;
            readyBtn.textContent = MP.isReady ? '✅ PRONTO!' : '⏳ DAR PRONTO';
        }
    }

    window.__kickPlayer = function(playerId) {
        removePlayerFromParty(playerId);
        sendNetworkMessage({
            type: 'party_sync',
            sender: myProfile,
            party: MP.party
        });
    };

    function renderOnlinePlayersList() {
        const container = document.getElementById('online-players-list');
        if (!container) return;

        const now = Date.now();
        const activeOnline = [];
        onlinePlayersRegistry.forEach((entry, id) => {
            if (id !== myProfile.id && now - entry.lastSeen < 15000) {
                activeOnline.push(entry.profile);
            }
        });

        // Add mock lobby bots if testing locally so user can test invite & group instantly
        if (activeOnline.length < 3) {
            const botPresets = [
                { id: 'bot_alex', nick: 'AlexPro', avatar: DEFAULT_AVATARS[1].url },
                { id: 'bot_beatriz', nick: 'Bia_Surfer', avatar: DEFAULT_AVATARS[2].url },
                { id: 'bot_carlos', nick: 'Carlos99', avatar: DEFAULT_AVATARS[3].url }
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
        // If bot, auto-join & ready after 1 second
        if (id.startsWith('bot_')) {
            if (MP.party.length < 4) {
                target.ready = false;
                MP.party.push(target);
                renderPartySlots();
                setTimeout(() => {
                    target.ready = true;
                    renderPartySlots();
                }, 1200);
            }
            return;
        }
        invitePlayer(target);
    };

    function requestStartMatch() {
        if (!checkCanStartMatch()) {
            alert('Atenção: Todos os membros do grupo devem dar PRONTO antes de iniciar!');
            return;
        }

        sendNetworkMessage({
            type: 'match_start',
            sender: myProfile,
            party: MP.party
        });

        startMultiplayerMatchCountdown();
    }

    function closeMultiplayerLobby() {
        const modal = document.getElementById('modal-mp-lobby');
        if (modal) modal.remove();
    }

    // ==========================================
    // 11. MOD STYLES INJECTION
    // ==========================================
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* TOP HUD BAR */
            .subway-top-hud {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 52px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 16px;
                box-sizing: border-box;
                z-index: 10000;
                background: linear-gradient(180deg, rgba(10, 16, 32, 0.92) 0%, rgba(10, 16, 32, 0) 100%);
                font-family: "Lilita One", "Verdana", sans-serif;
                pointer-events: none;
            }
            .subway-top-hud * {
                pointer-events: auto;
            }
            .subway-hud-btn {
                background: #1a2238;
                color: #fff;
                border: 2px solid #2e3e6b;
                border-radius: 8px;
                padding: 8px 14px;
                font-size: 13px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            }
            .subway-hud-btn:hover {
                transform: translateY(-2px);
                border-color: #4a68b5;
            }
            .mode-btn.mode-normal {
                border-color: #ffd83c;
                color: #ffd83c;
            }
            .mode-btn.mode-nocoin {
                border-color: #ff3b30;
                color: #ff3b30;
                background: #381212;
                animation: pulseRed 2s infinite;
            }
            @keyframes pulseRed {
                0%, 100% { box-shadow: 0 0 12px rgba(255, 59, 48, 0.4); }
                50% { box-shadow: 0 0 20px rgba(255, 59, 48, 0.8); }
            }
            .btn-mp-glow {
                background: linear-gradient(135deg, #007aff, #5856d6);
                border: 2px solid #70a1ff;
                color: #fff;
            }
            .btn-mp-glow:hover {
                box-shadow: 0 0 15px #007aff;
            }
            .subway-timer-display {
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(0, 0, 0, 0.65);
                border: 2px solid #ffd83c;
                border-radius: 20px;
                padding: 6px 18px;
                color: #fff;
                font-size: 20px;
                font-weight: 900;
                letter-spacing: 1px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }

            /* DEATH / NO-COIN BANNER */
            .subway-death-banner {
                position: fixed;
                top: 25%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(220, 20, 20, 0.95);
                color: #fff;
                font-family: "Lilita One", sans-serif;
                font-size: 26px;
                padding: 16px 32px;
                border-radius: 12px;
                border: 3px solid #ff7b72;
                box-shadow: 0 10px 30px rgba(255,0,0,0.6);
                z-index: 100000;
                animation: popIn 0.3s ease-out;
            }
            @keyframes popIn {
                0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }

            /* LIVE PLACEMENT HUD */
            .subway-live-placement-hud {
                position: fixed;
                top: 60px;
                left: 14px;
                background: rgba(12, 18, 36, 0.88);
                border: 2px solid #2a3b68;
                border-radius: 10px;
                padding: 10px 14px;
                font-family: sans-serif;
                color: #fff;
                z-index: 9999;
                min-width: 220px;
                box-shadow: 0 6px 16px rgba(0,0,0,0.5);
            }
            .placement-title {
                font-size: 12px;
                font-weight: 800;
                color: #ffd83c;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .placement-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px 0;
                font-size: 13px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .placement-row.is-me {
                color: #ffd83c;
                font-weight: bold;
            }
            .placement-rank {
                font-weight: 800;
                width: 32px;
            }
            .placement-avatar {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                object-fit: cover;
            }
            .placement-nick {
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .placement-badge {
                font-size: 10px;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .status-alive {
                background: #28a745;
                color: #fff;
            }
            .status-eliminated {
                background: #dc3545;
                color: #fff;
            }

            /* GHOST RUNNERS ON TRACK */
            .subway-ghost-player {
                position: fixed;
                width: 70px;
                height: 110px;
                pointer-events: none;
                z-index: 8000;
                transition: transform 0.08s linear;
            }
            .ghost-tag {
                position: absolute;
                top: -24px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 4px;
                background: rgba(0, 122, 255, 0.85);
                color: #fff;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: bold;
                white-space: nowrap;
                border: 1px solid #70a1ff;
            }
            .ghost-tag-avatar {
                width: 14px;
                height: 14px;
                border-radius: 50%;
            }
            .ghost-runner-body {
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, rgba(0, 200, 255, 0.45) 0%, rgba(0, 122, 255, 0.15) 70%, transparent 100%);
                border: 2px solid rgba(0, 220, 255, 0.6);
                border-radius: 20px;
                filter: blur(0.5px);
                animation: ghostFloat 1.2s ease-in-out infinite alternate;
            }
            @keyframes ghostFloat {
                0% { transform: translateY(0); }
                100% { transform: translateY(-6px); }
            }

            /* SPECTATOR HUD */
            .subway-spectator-hud {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(12, 18, 36, 0.92);
                border: 2px solid #5856d6;
                border-radius: 14px;
                padding: 12px 24px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            }
            .spec-banner {
                color: #ff3b30;
                font-weight: bold;
                font-size: 15px;
            }
            .spec-controls {
                display: flex;
                align-items: center;
                gap: 14px;
            }
            .btn-spec {
                background: #2a3b68;
                color: #fff;
                border: none;
                border-radius: 6px;
                padding: 6px 14px;
                font-weight: bold;
                cursor: pointer;
            }
            .spec-target-name {
                color: #ffd83c;
                font-weight: 800;
                font-size: 14px;
            }

            /* VICTORY MODAL */
            .subway-victory-modal {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
            }
            .victory-box {
                background: #141c33;
                border: 3px solid #ffd83c;
                border-radius: 18px;
                padding: 30px 40px;
                text-align: center;
                color: #fff;
                max-width: 420px;
                box-shadow: 0 10px 40px rgba(255, 216, 60, 0.4);
            }
            .victory-crown { font-size: 54px; }
            .victory-title { font-size: 30px; color: #ffd83c; margin: 8px 0; }
            .victory-sub { font-size: 14px; color: #a0aec0; margin-bottom: 20px; }
            .victory-table { background: #0c1224; border-radius: 10px; padding: 12px; margin-bottom: 20px; }
            .victory-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #1a233a; }
            .v-rank { font-weight: bold; width: 40px; }
            .v-avatar { width: 24px; height: 24px; border-radius: 50%; }
            .v-nick { flex: 1; text-align: left; }
            .btn-victory-back {
                background: #ffd83c;
                color: #000;
                font-weight: 900;
                font-size: 16px;
                border: none;
                border-radius: 8px;
                padding: 12px 28px;
                cursor: pointer;
            }

            /* COUNTDOWN OVERLAY */
            .subway-countdown-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                font-family: "Lilita One", sans-serif;
            }
            .countdown-num {
                font-size: 110px;
                color: #ffd83c;
                text-shadow: 0 0 20px rgba(255, 216, 60, 0.8);
            }
            .countdown-sub {
                font-size: 20px;
                color: #fff;
                margin-top: 20px;
                letter-spacing: 1px;
            }

            /* TOAST INVITE */
            .subway-invite-toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #19233f;
                border: 2px solid #007aff;
                border-radius: 12px;
                padding: 14px 18px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 100000;
                color: #fff;
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            }
            .toast-avatar { width: 36px; height: 36px; border-radius: 50%; background-size: cover; }
            .toast-actions { display: flex; gap: 8px; }
            .btn-toast-accept { background: #28a745; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; }
            .btn-toast-decline { background: #dc3545; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; }

            /* MODAL BACKDROP & BOX */
            .subway-modal-backdrop {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(4, 8, 20, 0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                font-family: sans-serif;
            }
            .subway-modal-box {
                background: #121a30;
                border: 2px solid #2e3e6b;
                border-radius: 16px;
                width: 90%;
                max-width: 780px;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                color: #fff;
                overflow: hidden;
                box-shadow: 0 16px 40px rgba(0,0,0,0.7);
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 22px;
                border-bottom: 1px solid #1f2b4d;
                background: #0d1324;
            }
            .modal-header h2 { margin: 0; font-size: 20px; color: #ffd83c; font-family: "Lilita One", sans-serif; }
            .btn-modal-close {
                background: transparent;
                border: none;
                color: #a0aec0;
                font-size: 20px;
                cursor: pointer;
            }
            .btn-modal-close:hover { color: #fff; }

            /* LOBBY PROFILE */
            .lobby-profile-card {
                display: flex;
                align-items: center;
                gap: 18px;
                padding: 16px 22px;
                background: #17203b;
                border-bottom: 1px solid #1f2b4d;
            }
            .profile-avatar-wrap img {
                width: 68px;
                height: 68px;
                border-radius: 50%;
                border: 3px solid #007aff;
                object-fit: cover;
            }
            .profile-info-wrap {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .profile-input-group label {
                font-size: 11px;
                color: #a0aec0;
                font-weight: bold;
            }
            .profile-input-group input {
                width: 100%;
                background: #0d1324;
                border: 1px solid #2e3e6b;
                border-radius: 6px;
                padding: 6px 10px;
                color: #fff;
                box-sizing: border-box;
                font-size: 13px;
            }
            .avatar-presets {
                display: flex;
                gap: 8px;
                margin-top: 4px;
            }
            .preset-img {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                cursor: pointer;
                border: 1px solid #2e3e6b;
                transition: transform 0.2s;
            }
            .preset-img:hover {
                transform: scale(1.15);
                border-color: #ffd83c;
            }
            .btn-save-profile {
                background: #007aff;
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 10px 16px;
                font-weight: bold;
                cursor: pointer;
                align-self: center;
            }

            /* LOBBY GRID */
            .lobby-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                padding: 16px 22px;
                overflow-y: auto;
            }
            .lobby-column {
                background: #0d1324;
                border: 1px solid #1f2b4d;
                border-radius: 12px;
                padding: 14px;
                display: flex;
                flex-direction: column;
            }
            .col-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            .col-header h3 { margin: 0; font-size: 14px; color: #a0aec0; }
            .party-hint { font-size: 11px; color: #ffd83c; font-weight: bold; }
            .btn-refresh-online {
                background: #1c2747;
                color: #a0aec0;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
            }
            .party-slots-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                flex: 1;
            }
            .party-slot {
                border-radius: 8px;
                padding: 10px 12px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .slot-filled {
                background: #17203b;
                border: 2px solid #2e3e6b;
            }
            .slot-ready {
                border-color: #28a745;
                background: #12281e;
            }
            .slot-waiting {
                border-color: #f39c12;
            }
            .slot-empty {
                border: 2px dashed #222f52;
                justify-content: center;
                color: #4a5d8a;
                font-size: 13px;
                padding: 14px;
            }
            .slot-avatar {
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background-size: cover;
                background-position: center;
            }
            .slot-details {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            .slot-nick { font-weight: bold; font-size: 14px; }
            .slot-status { font-size: 11px; font-weight: 800; margin-top: 2px; }
            .st-ready { color: #28a745; }
            .st-waiting { color: #f39c12; }
            .btn-kick {
                background: transparent;
                border: none;
                color: #dc3545;
                font-size: 16px;
                cursor: pointer;
            }
            .party-bottom-actions {
                display: flex;
                gap: 10px;
                margin-top: 14px;
            }
            .btn-ready {
                flex: 1;
                padding: 12px;
                border-radius: 8px;
                font-weight: 900;
                font-size: 14px;
                cursor: pointer;
                border: none;
            }
            .ready-off { background: #f39c12; color: #fff; }
            .ready-on { background: #28a745; color: #fff; }
            .btn-start-match {
                flex: 1.2;
                background: #2a375a;
                color: #6a7b9f;
                border: none;
                border-radius: 8px;
                font-weight: 900;
                font-size: 14px;
                cursor: not-allowed;
            }
            .btn-start-match.can-start {
                background: linear-gradient(135deg, #007aff, #5856d6);
                color: #fff;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0, 122, 255, 0.4);
            }

            /* ONLINE PLAYERS LIST */
            .online-players-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 250px;
                overflow-y: auto;
            }
            .player-card {
                background: #17203b;
                border: 1px solid #222f52;
                border-radius: 8px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .card-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                object-fit: cover;
            }
            .card-nick { flex: 1; font-weight: bold; font-size: 13px; }
            .btn-invite {
                background: #007aff;
                color: #fff;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
            }
            .btn-invite:disabled {
                background: #2a375a;
                color: #6a7b9f;
                cursor: default;
            }

            /* RECORDS TABLE */
            .records-filter {
                display: flex;
                gap: 8px;
                padding: 12px 22px;
                background: #0d1324;
            }
            .btn-filter {
                background: #1c2747;
                color: #a0aec0;
                border: none;
                border-radius: 6px;
                padding: 6px 14px;
                font-weight: bold;
                cursor: pointer;
            }
            .btn-filter.active {
                background: #007aff;
                color: #fff;
            }
            .records-list {
                padding: 16px 22px;
                overflow-y: auto;
                max-height: 400px;
            }
            .records-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            .records-table th {
                text-align: left;
                padding: 8px;
                color: #a0aec0;
                border-bottom: 1px solid #1f2b4d;
            }
            .records-table td {
                padding: 10px 8px;
                border-bottom: 1px solid #17203b;
            }
            .rec-time {
                font-weight: 900;
                color: #ffd83c;
                font-family: monospace;
                font-size: 14px;
            }
            .badge-nocoin {
                background: #ff3b30;
                color: #fff;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
            }
            .badge-normal {
                background: #f39c12;
                color: #fff;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
            }
            .no-records, .no-players {
                text-align: center;
                padding: 24px;
                color: #6a7b9f;
                font-size: 13px;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize UI on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyles();
            injectUI();
        });
    } else {
        injectStyles();
        injectUI();
    }

})();
