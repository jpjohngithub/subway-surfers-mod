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
                '#nl-badge-frame, iframe[title*="Netlify"], iframe[srcdoc*="Netlify"], script[src*=".netlify/scripts"], [data-netlify-site-id], [data-nf-variant], netlify-drawer, #netlify-drawer, .netlify-badge, iframe[src*="netlify"]'
            );
            badElements.forEach(el => el.remove());
        } catch(e) {}
    }
    nukeNetlifyBadge();
    const netlifyObserver = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
            const added = mutations[i].addedNodes;
            for (let j = 0; j < added.length; j++) {
                const n = added[j];
                if (n && n.nodeType === 1) {
                    const id = (n.id || '').toLowerCase();
                    const cls = typeof n.className === 'string' ? n.className.toLowerCase() : '';
                    if (id.includes('netlify') || id === 'nl-badge-frame' || cls.includes('netlify')) {
                        n.remove();
                    }
                }
            }
        }
    });
    netlifyObserver.observe(document.documentElement, { childList: true, subtree: true });

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
    window.UNLIMITED_MODE = localStorage.getItem('subway_unlimited_v2') !== 'false';
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
    // Keyboard routing is handled synchronously inside ControllerSystem (dependencies.bundle.js).

    try { localStorage.removeItem('sw_shader_lighting'); } catch (e) {}

    const _swSavedVol = localStorage.getItem('sw_volume');
    const _swSavedFps = localStorage.getItem('sw_fps');
    const GFX_SETTINGS = {
        fps: (_swSavedFps === '60' || _swSavedFps === '120' || _swSavedFps === '240') ? _swSavedFps : '240', // '60' | '120' | '240'
        showFps: localStorage.getItem('sw_show_fps') === '1',
        saturation: parseInt(localStorage.getItem('sw_saturation') || '100', 10), // 50 - 300
        contrast: parseInt(localStorage.getItem('sw_contrast') || '100', 10), // 50 - 300
        aspectRatio: localStorage.getItem('sw_aspect_ratio') || 'native', // 'native' | 'stretched_4_3' | 'stretched_16_10' | 'square_1_1'
        coinOutline: localStorage.getItem('sw_coin_outline') || '0', // '0' | '1' (contorno) | '2' (preta)
        volume: _swSavedVol !== null ? Math.max(0, Math.min(100, parseInt(_swSavedVol, 10) || 0)) : 30, // 0 - 100 (padrão 30%)
        motionBlur: localStorage.getItem('sw_motion_blur') || 'soft', // 'off' | 'soft' | 'high'
        shaders: (localStorage.getItem('sw_shaders') === 'off') ? 'off' : 'medium', // 'off' | 'medium' (Ativado)
        noRevive: localStorage.getItem('sw_no_revive') !== '0', // true by default
    };
    window.__SW_VOLUME_OVERRIDE__ = GFX_SETTINGS.volume / 100;
    window.__SW_NO_REVIVE__ = GFX_SETTINGS.noRevive;
    window.__swipeT = 8;
    try {
        document.documentElement.style.setProperty('--game-saturation', GFX_SETTINGS.saturation + '%');
        document.documentElement.style.setProperty('--game-contrast', GFX_SETTINGS.contrast + '%');
        applyScreenAspectRatio(GFX_SETTINGS.aspectRatio);
    } catch(e) {}

    function applyGameVolume(pct) {
        const clamped = Math.max(0, Math.min(100, parseInt(pct, 10) || 0));
        const norm = clamped / 100;
        window.__SW_VOLUME_OVERRIDE__ = norm;
        try {
            if (window.GAME_CONFIG) window.GAME_CONFIG.volume = norm;
            if (window.__SW_CONFIG__) window.__SW_CONFIG__.volume = norm;
            if (window.Howler && typeof window.Howler.volume === 'function') {
                window.Howler.volume(norm);
            }
            if (window.__SW_AUDIO_MGR__ && (!window.app || !window.app.user || !window.app.user.muted)) {
                window.__SW_AUDIO_MGR__.volume = norm;
            }
            if (window.__SW_SOUND_INST__ && typeof window.__SW_SOUND_INST__.volume === 'function' && !window.__SW_SOUND_INST__.muted) {
                window.__SW_SOUND_INST__.volume(norm);
            }
            if (window.app) {
                if (window.app.config) window.app.config.volume = norm;
                if (window.app.sound && typeof window.app.sound.volume === 'function' && !window.app.sound.muted) {
                    window.app.sound.volume(norm);
                }
            }
        } catch(e) {}
    }

    window.__SW_PRO_HUB__ = false;
    window.__SW_UNLIMITED_TICK__ = ((parseInt(GFX_SETTINGS.fps, 10) || 240) > 65);
    window.__SW_TUNING__ = Object.assign({
        halfWagonChance: 0.1,
        energyCoinScale: 2.05,
        shadowSoftness: 1.0,
    }, window.__SW_TUNING__ || {});

    function getFPSLabel(val) {
        return (parseInt(val, 10) || 240) + ' FPS';
    }

    function getShaderLabel(val) {
        return val === 'off' ? 'Desativado' : 'Ativado';
    }

    function ensureReformulatedShadowTexture() {
        if (window.__SW_SHADOW_TEX__) return window.__SW_SHADOW_TEX__;
        try {
            const lib = window.__lib || (window.app && window.app.library);
            const originalMap = lib && lib.getMap && (lib.getMap('shadow') || lib.getMap('props-tex'));
            const TextureClass = originalMap && originalMap.constructor;
            if (!TextureClass || typeof TextureClass.from !== 'function' || typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 128; c.height = 128;
            const ctx = c.getContext('2d');
            if (ctx) {
                const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
                g.addColorStop(0.0, 'rgba(2, 4, 12, 0.90)');
                g.addColorStop(0.45, 'rgba(4, 6, 16, 0.65)');
                g.addColorStop(0.78, 'rgba(6, 10, 22, 0.22)');
                g.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, 128, 128);
            }
            window.__SW_SHADOW_TEX__ = TextureClass.from(c);
            return window.__SW_SHADOW_TEX__;
        } catch(e) { return null; }
    }

    function applyShaderAndShadowPipeline() {
        const mode = (GFX_SETTINGS.shaders === 'off') ? 'off' : 'medium';
        window.__SW_SHADER_MODE__ = mode;
        const lv = mode === 'off' ? 0.0 : 1.0;
        if (!window.__SW_SHADER_VEC__) window.__SW_SHADER_VEC__ = new Float32Array([lv, 0, 0, 0]);
        window.__SW_SHADER_VEC__[0] = lv;
        const tex = ensureReformulatedShadowTexture();
        if (tex) window.__SW_SHADOW_TEX__ = tex;

        // 1) Tune 3D Lights per mode (cool ambient fill vs warm sun key)
        try {
            const systems = (window.__SW_LIGHT_SYSTEMS__ || []).slice();
            const gScene = window.game && window.game.scene && window.game.scene.view3d && window.game.scene.view3d.lights;
            if (gScene && !systems.includes(gScene)) systems.push(gScene);
            for (const ls of systems) {
                if (!ls) continue;
                if (ls.ambientLight) {
                    if (mode === 'off') {
                        ls.ambientLight.color = 0xffffff;
                        ls.ambientLight.intensity = 0.5;
                    } else {
                        ls.ambientLight.color = 0x9bbdff;
                        ls.ambientLight.intensity = 0.34;
                    }
                    ls.ambientLight.dirty = true;
                    if (typeof ls.ambientLight.update === 'function') ls.ambientLight.update();
                }
                if (Array.isArray(ls.lightEntities)) {
                    for (const le of ls.lightEntities) {
                        const l = le && le.light;
                        if (!l) continue;
                        if (mode === 'off') {
                            l.color = 0xffffff;
                            l.intensity = 1.0;
                        } else {
                            l.color = 0xffebd2;
                            l.intensity = 1.58;
                            if (l.direction && l.direction.set) l.direction.set(0.48, -0.80, -0.36);
                        }
                        if (typeof l.update === 'function') l.update();
                    }
                }
            }
        } catch(e) {}

        // 2) Keep native multiply shadow quads clean neutral white (no dark tinted boxes)
        try {
            const root = (window.game && (window.game.scene || window.game)) || null;
            const visited = new Set();
            const tuneObj = (obj, depth) => {
                if (!obj || depth > 4 || visited.has(obj)) return;
                visited.add(obj);
                const view = obj.view3d;
                if (view && view.material) {
                    const name = ((obj.name || '') + ' ' + (obj.materialName || '') + ' ' + (obj.groupName || '')).toLowerCase();
                    if (name.includes('shadow')) {
                        const mats = Array.isArray(view.material) ? view.material : [view.material];
                        mats.forEach(m => {
                            if (m) m.color = 0xffffff;
                        });
                    }
                }
                const ch = obj.children || (obj.container && obj.container.children);
                if (ch && ch.length && depth < 3) {
                    for (let i = 0; i < Math.min(ch.length, 160); i++) tuneObj(ch[i], depth + 1);
                }
            };
            if (root) tuneObj(root, 0);
        } catch(e) {}

        // 3) Sync Hero shadow right away (more evident when shaders active)
        try {
            const hero = window.game && window.game.hero;
            if (hero && hero.shadow) {
                if (hero.shadow.scale && hero.shadow.scale.set) {
                    const hs = mode === 'off' ? 1.0 : 1.24;
                    hero.shadow.scale.set(hs, hs, hs);
                }
                if (typeof hero.shadow.update === 'function') hero.shadow.update();
            }
        } catch(e) {}

        // 4) Sync obstacle contact shadows
        for (const obs of customObstacles) {
            if (obs && obs.shadowPart) {
                obs.shadowPart.active = mode !== 'off';
                if (obs.shadowPart.scale && obs.shadowPart.scale.set) {
                    const ss = mode === 'off' ? 1.0 : 1.26;
                    obs.shadowPart.scale.set(ss, ss, ss);
                }
            }
        }

        // 5) Real-Time Bloom + Cinematic Post-Processing Overlay
        try {
            let vig = document.getElementById('sw-shader-vignette');
            if (!vig && document.body) {
                vig = document.createElement('div');
                vig.id = 'sw-shader-vignette';
                vig.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;transition:opacity 0.25s ease;background:radial-gradient(ellipse at 50% 42%, rgba(255,244,224,0.06) 0%, rgba(0,0,0,0) 56%, rgba(4,6,16,0.34) 100%);';
                document.body.appendChild(vig);
            }
            if (vig) vig.style.opacity = mode === 'off' ? '0' : '1';

            let bloom = document.getElementById('sw-shader-bloom');
            if (mode !== 'off') {
                if (!bloom && document.body) {
                    bloom = document.createElement('div');
                    bloom.id = 'sw-shader-bloom';
                    bloom.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;mix-blend-mode:screen;opacity:0.18;transition:opacity 0.25s ease;background:radial-gradient(circle at 50% 48%, rgba(255, 230, 160, 0.22) 0%, rgba(255, 180, 80, 0.08) 40%, transparent 68%);';
                    document.body.appendChild(bloom);
                }
                if (bloom) bloom.style.opacity = '0.18';
            } else if (bloom) {
                bloom.style.opacity = '0';
            }

            const src = document.getElementById('pixi-canvas') || (window.app && window.app.view) || document.querySelector('canvas');
            if (src) {
                applyCanvasGraphicsFilter(src, GFX_SETTINGS.saturation, GFX_SETTINGS.contrast);
            }
        } catch(e) {}
    }

    function applyTickerMaxFPS(targetMaxFPS) {
        const minFps = targetMaxFPS === 0 ? 1 : 10;
        window.__SW_TARGET_MAX_FPS__ = targetMaxFPS;
        window.__SW_UNLIMITED_TICK__ = (targetMaxFPS === 0 || targetMaxFPS > 65);
        const cfgTicker = (tkr) => {
            if (!tkr) return;
            const changed = (tkr.maxFPS !== targetMaxFPS || tkr.minFPS !== minFps);
            tkr.maxFPS = targetMaxFPS;
            tkr.minFPS = minFps;
            if (changed && tkr.started && typeof tkr._cancelIfNeeded === 'function' && typeof tkr._requestIfNeeded === 'function') {
                tkr._cancelIfNeeded();
                tkr._requestIfNeeded();
            }
        };
        try {
            (window.__SW_ALL_TICKERS__ || []).forEach(cfgTicker);
            cfgTicker(window.__SW_TICKER_SYSTEM__);
            cfgTicker(window.__SW_TICKER_SHARED__);
            if (window.app) {
                cfgTicker(window.app.ticker);
                if (window.app.stage) cfgTicker(window.app.stage.ticker);
                const tRef = window.app.ticker || (window.app.stage && window.app.stage.ticker);
                const TickerCls = tRef && tRef.constructor;
                if (TickerCls && TickerCls.shared) cfgTicker(TickerCls.shared);
                if (TickerCls && TickerCls.system) cfgTicker(TickerCls.system);
            }
            ensureFPSCounterHook();
        } catch(e) {}
    }

    let _fpsTickFrames = 0;
    let _fpsLastSample = performance.now();
    let _fpsHooked = false;
    function updateFPSCounterVisibility() {
        const el = document.getElementById('sw-fps-counter');
        if (el) el.style.display = GFX_SETTINGS.showFps ? 'inline-flex' : 'none';
    }
    function ensureFPSCounterHook() {
        updateFPSCounterVisibility();
        if (_fpsHooked) return;
        const ticker = (window.app && window.app.stage && window.app.stage.ticker) || window.__SW_TICKER_SYSTEM__ || window.__SW_TICKER_SHARED__ || (window.app && window.app.ticker);
        const sampleNow = () => {
            const now = performance.now();
            if (typeof updateNoCoinObstacleEngine === 'function') {
                window.__swLastObsTick = now;
                try { updateNoCoinObstacleEngine(); } catch(e) {}
            }
            _fpsTickFrames++;
            const dt = now - _fpsLastSample;
            if (dt >= 250) {
                const fps = Math.min(1000, Math.round((_fpsTickFrames * 1000) / dt));
                _fpsTickFrames = 0;
                _fpsLastSample = now;
                if (GFX_SETTINGS.showFps) {
                    const valEl = document.getElementById('sw-fps-val');
                    if (valEl) valEl.textContent = fps + ' FPS';
                }
            }
        };
        if (ticker && typeof ticker.add === 'function') {
            _fpsHooked = true;
            ticker.add(sampleNow);
            return;
        }
        if (typeof requestAnimationFrame === 'function') {
            _fpsHooked = true;
            const rafLoop = () => {
                const tkr = (window.app && window.app.stage && window.app.stage.ticker) || window.__SW_TICKER_SYSTEM__ || window.__SW_TICKER_SHARED__ || (window.app && window.app.ticker);
                if (tkr && typeof tkr.add === 'function') {
                    tkr.add(sampleNow);
                    return;
                }
                sampleNow();
                requestAnimationFrame(rafLoop);
            };
            requestAnimationFrame(rafLoop);
        }
    }

    function getMotionBlurLabel(val) {
        if (val === 'off') return 'Desativado';
        if (val === 'high') return 'Intenso';
        return 'Suave';
    }

    // IMMEDIATELY apply stored saturation to root on script load so F5 NEVER resets!
    try {
        document.documentElement.style.setProperty('--game-saturation', GFX_SETTINGS.saturation + '%');
    } catch(e) {}

    function applyGraphicsSettings() {
        const satVal = GFX_SETTINGS.saturation || 100;
        const conVal = GFX_SETTINGS.contrast || 100;
        document.documentElement.style.setProperty('--game-saturation', satVal + '%');
        document.documentElement.style.setProperty('--game-contrast', conVal + '%');

        const canvas = document.querySelector('#game-canvas') || (window.app && window.app.view) || document.querySelector('canvas');
        if (canvas) {
            applyCanvasGraphicsFilter(canvas, satVal, conVal);
        }
        const blurCanvas = document.getElementById('sw-motion-blur-canvas');
        if (blurCanvas) {
            blurCanvas.style.filter = `saturate(${satVal}%) contrast(${conVal}%)`;
            if (GFX_SETTINGS.motionBlur === 'off') blurCanvas.style.display = 'none';
        }

        // 2. Ultra-Fluid Framerate (Unlock Pixi System & Shared Tickers up to 240Hz)
        const targetMaxFPS = Math.min(240, parseInt(GFX_SETTINGS.fps, 10) || 240);
        applyTickerMaxFPS(targetMaxFPS);
        applyScreenAspectRatio(GFX_SETTINGS.aspectRatio);
        if (typeof updateFPSVisibility === 'function') updateFPSVisibility();

        // 3. Smooth Hero Character Skeletal Animation & Snappy Movement
        optimizeHeroAnimAndFluidity();

        // 4. Shaders & Reformulated Shadows
        applyShaderAndShadowPipeline();

        // 5. Game Volume (default 30%)
        applyGameVolume(GFX_SETTINGS.volume);

        // 6. GPU Velocity + Radial Motion Blur Overlay
        initMotionBlurEngine();
    }

    function applyCanvasGraphicsFilter(canvas, saturation = GFX_SETTINGS.saturation || 100, contrast = GFX_SETTINGS.contrast || 100) {
        if (!canvas) return;
        const bloomEffect = GFX_SETTINGS.shaders !== 'off' ? ' drop-shadow(0 0 5px rgba(255, 235, 175, 0.16))' : '';
        canvas.style.filter = `saturate(${saturation}%) contrast(${contrast}%)${bloomEffect}`;
    }

    function optimizeHeroAnimAndFluidity() {
        try {
            const game = window.game || (window.app && window.app.game);
            const hero = (game && game.hero) || null;
            if (hero && hero.lane && typeof hero.lane.change === 'function' && !hero.lane.__swSnappyPatched) {
                hero.lane.__swSnappyPatched = true;
                const origLaneChange = hero.lane.change.bind(hero.lane);
                hero.lane.change = function(step) {
                    const res = origLaneChange(step);
                    if (typeof this.changeDuration === 'number' && this.changeDuration > 0) {
                        this.changeDuration = Math.max(this.changeDuration * 0.86, 0.125);
                    }
                    return res;
                };
            }
        } catch(e) {}
    }

    function initMotionBlurEngine() {
        try {
            if (window.__swMotionBlurHooked) return;
            const app = window.app;
            const gameCanvas = (app && app.renderer && app.renderer.view) || (app && app.view) || document.querySelector('#game-canvas') || document.querySelector('canvas');
            if (!app || !app.renderer || !gameCanvas) return;

            const blurCanvas = document.createElement('canvas');
            blurCanvas.id = 'sw-motion-blur-canvas';
            blurCanvas.style.cssText = 'position:fixed;pointer-events:none;z-index:50;display:none;background:transparent;';
            blurCanvas.style.filter = `saturate(${GFX_SETTINGS.saturation || 100}%)`;
            if (gameCanvas.parentNode) {
                gameCanvas.parentNode.insertBefore(blurCanvas, gameCanvas.nextSibling);
            } else {
                document.body.appendChild(blurCanvas);
            }

            const gl = blurCanvas.getContext('webgl', {
                alpha: true,
                premultipliedAlpha: false,
                antialias: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: false,
                powerPreference: 'high-performance'
            }) || blurCanvas.getContext('experimental-webgl', { alpha: true, depth: false });

            if (!gl) {
                blurCanvas.remove();
                return;
            }

            const vsSrc = [
                'attribute vec2 aPos;',
                'varying vec2 vUv;',
                'void main(){',
                '  vUv = aPos * 0.5 + 0.5;',
                '  gl_Position = vec4(aPos, 0.0, 1.0);',
                '}'
            ].join('\n');

            const fsSrc = [
                'precision lowp float;',
                'uniform sampler2D uTex;',
                'uniform float uStrength;',
                'uniform vec2 uVel;',
                'uniform vec2 uCenter;',
                'varying vec2 vUv;',
                'void main(){',
                '  if(uStrength <= 0.002){ gl_FragColor = vec4(0.0); return; }',
                '  float hudMask = 1.0 - smoothstep(0.90, 0.99, vUv.y);',
                '  vec2 dFocus = (vUv - vec2(0.5, 0.42)) * vec2(1.12, 0.96);',
                '  float peripheral = smoothstep(0.14, 0.52, length(dFocus));',
                '  float zoneMask = hudMask * peripheral;',
                '  if(zoneMask <= 0.01){ gl_FragColor = vec4(0.0); return; }',
                '  vec2 radial = (vUv - uCenter) * vec2(1.14, 1.32);',
                '  vec2 dir = radial * (uStrength * 2.45) + uVel * (uStrength * 1.45);',
                '  dir *= (0.42 + 0.58 * peripheral);',
                '  float maxLen = 0.25;',
                '  float dLen = length(dir);',
                '  if(dLen > maxLen) dir *= (maxLen / dLen);',
                '  vec3 acc = texture2D(uTex, vUv).rgb * 0.72;',
                '  float totalW = 0.72;',
                '  const int TAPS = 8;',
                '  for(int i = 1; i <= TAPS; i++){',
                '    float t = float(i) / float(TAPS);',
                '    float w = (1.18 - t * 0.52);',
                '    vec2 uvFwd = clamp(vUv + dir * t, vec2(0.002), vec2(0.998));',
                '    vec2 uvBwd = clamp(vUv - dir * (t * 0.76), vec2(0.002), vec2(0.998));',
                '    acc += texture2D(uTex, uvFwd).rgb * w;',
                '    acc += texture2D(uTex, uvBwd).rgb * (w * 0.85);',
                '    totalW += w * 1.85;',
                '  }',
                '  vec3 blurred = acc / totalW;',
                '  float edgeAlpha = clamp(zoneMask * min(1.0, uStrength * 13.5), 0.0, 0.96);',
                '  gl_FragColor = vec4(blurred, edgeAlpha);',
                '}'
            ].join('\n');

            const compile = (type, src) => {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                return s;
            };
            const prog = gl.createProgram();
            gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
            gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
            gl.linkProgram(prog);
            gl.useProgram(prog);

            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
            const aPos = gl.getAttribLocation(prog, 'aPos');
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            const uTex = gl.getUniformLocation(prog, 'uTex');
            const uStrength = gl.getUniformLocation(prog, 'uStrength');
            const uVel = gl.getUniformLocation(prog, 'uVel');
            const uCenter = gl.getUniformLocation(prog, 'uCenter');
            gl.uniform1i(uTex, 0);

            window.__swMotionBlurHooked = true;
            let smoothStrength = 0;
            let smoothVx = 0;
            let smoothVy = 0;
            let lastTime = performance.now();
            let cachedRect = null;
            let cachedCw = 0, cachedCh = 0, cachedIw = 0, cachedIh = 0;

            app.renderer.on('postrender', () => {
                try {
                    const mode = GFX_SETTINGS.motionBlur || 'soft';
                    if (mode === 'off') {
                        if (blurCanvas.style.display !== 'none') blurCanvas.style.display = 'none';
                        smoothStrength = 0;
                        return;
                    }

                    const now = performance.now();
                    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
                    lastTime = now;

                    const game = window.game || (window.app && window.app.game);
                    const hero = game && game.hero;
                    const body = hero && hero.body;
                    const posZ = (body && typeof body.z === 'number') ? body.z : null;
                    const modalOpen = !!document.getElementById('modal-unified-menu');
                    const clip = (hero && hero.anim && hero.anim.currentAnimationClipName) || '';
                    const statePlaying = !!(hero && hero.state && hero.state.playing);
                    const heroAlive = hero && hero.isAlive !== false && !/crash|die|caught|idle/i.test(clip);
                    const isRunning = !!(hero && body && (statePlaying || (posZ !== null && posZ !== 0 && heroAlive)) && !window.isGamePaused && !modalOpen);

                    let targetStrength = 0;
                    let targetVx = 0;
                    let targetVy = 0;

                    if (isRunning) {
                        const speedRatio = (game && game.stats && typeof game.stats.speedRatio === 'number') ? game.stats.speedRatio : 0.45;
                        const dashBoost = (typeof window.__dashSpeedMult === 'number' && window.__dashSpeedMult > 1) ? (window.__dashSpeedMult - 1) * 0.9 : 0;
                        const vx = body && body.velocity ? (body.velocity.x || 0) : 0;
                        const vy = body && body.velocity ? (body.velocity.y || 0) : 0;
                        const mult = mode === 'high' ? 0.28 : 0.14;

                        targetStrength = mult * (0.85 + speedRatio * 1.15 + dashBoost + Math.min(0.95, Math.abs(vx) * 0.04));
                        targetVx = Math.max(-1.6, Math.min(1.6, -vx * 0.055));
                        targetVy = Math.max(-1.0, Math.min(1.0, -vy * 0.03));
                    }

                    const lerpRate = Math.min(1, dt * (targetStrength > smoothStrength ? 16 : 22));
                    smoothStrength += (targetStrength - smoothStrength) * lerpRate;
                    smoothVx += (targetVx - smoothVx) * Math.min(1, dt * 18);
                    smoothVy += (targetVy - smoothVy) * Math.min(1, dt * 18);

                    if (smoothStrength < 0.002 || gameCanvas.width < 2 || gameCanvas.height < 2) {
                        if (blurCanvas.style.display !== 'none') blurCanvas.style.display = 'none';
                        return;
                    }

                    const cw = gameCanvas.clientWidth, ch = gameCanvas.clientHeight;
                    const iw = window.innerWidth, ih = window.innerHeight;
                    if (!cachedRect || cw !== cachedCw || ch !== cachedCh || iw !== cachedIw || ih !== cachedIh) {
                        cachedRect = gameCanvas.getBoundingClientRect();
                        cachedCw = cw; cachedCh = ch; cachedIw = iw; cachedIh = ih;
                        if (cachedRect.width >= 10 && cachedRect.height >= 10) {
                            blurCanvas.style.left = cachedRect.left + 'px';
                            blurCanvas.style.top = cachedRect.top + 'px';
                            blurCanvas.style.width = cachedRect.width + 'px';
                            blurCanvas.style.height = cachedRect.height + 'px';
                        }
                    }
                    if (!cachedRect || cachedRect.width < 10 || cachedRect.height < 10) return;

                    const bw = Math.max(64, (gameCanvas.width * 0.60) | 0);
                    const bh = Math.max(64, (gameCanvas.height * 0.60) | 0);
                    if (blurCanvas.width !== bw || blurCanvas.height !== bh) {
                        blurCanvas.width = bw;
                        blurCanvas.height = bh;
                    }
                    if (blurCanvas.style.display !== 'block') blurCanvas.style.display = 'block';

                    gl.viewport(0, 0, bw, bh);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gameCanvas);

                    gl.uniform1f(uStrength, smoothStrength);
                    gl.uniform2f(uVel, smoothVx, smoothVy);
                    gl.uniform2f(uCenter, 0.5, 0.58);
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                } catch(e) {}
            });
        } catch(e) {}
    }

    window.__cycleMotionBlur = function() {
        const order = ['off', 'soft', 'high'];
        const curIdx = order.indexOf(GFX_SETTINGS.motionBlur);
        GFX_SETTINGS.motionBlur = order[(curIdx + 1) % order.length];
        localStorage.setItem('sw_motion_blur', GFX_SETTINGS.motionBlur);
        applyGraphicsSettings();
        const label = getMotionBlurLabel(GFX_SETTINGS.motionBlur);
        const el = document.getElementById('val-gfx-motionblur');
        if (el) el.textContent = label;
        showHUDNotification('Motion Blur: ' + label);
    };

    window.__cycleFPS = function() {
        const order = ['240', '120', '60'];
        const curIdx = order.indexOf(GFX_SETTINGS.fps);
        GFX_SETTINGS.fps = order[(curIdx + 1) % order.length];
        localStorage.setItem('sw_fps', GFX_SETTINGS.fps);
        applyGraphicsSettings();
        const label = getFPSLabel(GFX_SETTINGS.fps);
        const el = document.getElementById('val-gfx-fps');
        if (el) el.textContent = label;
        showHUDNotification('Taxa de FPS: ' + label);
    };

    window.__toggleShowFPS = function() {
        GFX_SETTINGS.showFps = !GFX_SETTINGS.showFps;
        localStorage.setItem('sw_show_fps', GFX_SETTINGS.showFps ? '1' : '0');
        const el = document.getElementById('val-gfx-showfps');
        if (el) el.textContent = GFX_SETTINGS.showFps ? 'Ativado' : 'Desativado';
        ensureFPSCounterHook();
        updateFPSCounterVisibility();
        showHUDNotification('Mostrar FPS: ' + (GFX_SETTINGS.showFps ? 'Ativado' : 'Desativado'));
    };

    window.__toggleNoRevive = function() {
        GFX_SETTINGS.noRevive = !GFX_SETTINGS.noRevive;
        window.__SW_NO_REVIVE__ = GFX_SETTINGS.noRevive;
        localStorage.setItem('sw_no_revive', GFX_SETTINGS.noRevive ? '1' : '0');
        const el = document.getElementById('val-gfx-norevive');
        if (el) el.textContent = GFX_SETTINGS.noRevive ? 'Ativado' : 'Desativado';
        showHUDNotification('Sem Revive: ' + (GFX_SETTINGS.noRevive ? 'Ativado' : 'Desativado'));
    };

    window.__cycleShaders = function() {
        GFX_SETTINGS.shaders = (GFX_SETTINGS.shaders === 'off') ? 'medium' : 'off';
        localStorage.setItem('sw_shaders', GFX_SETTINGS.shaders);
        applyGraphicsSettings();
        const label = getShaderLabel(GFX_SETTINGS.shaders);
        const el = document.getElementById('val-gfx-shaders');
        if (el) el.textContent = label;
        showHUDNotification('Shaders & Sombras: ' + label);
    };

    function getAspectRatioLabel(val) {
        if (val === 'stretched_4_3') return '4:3 Esticada (Pro)';
        if (val === 'stretched_16_10') return '16:10 Esticada';
        if (val === 'square_1_1') return '1:1 Quadrado';
        return 'Padrão (Auto)';
    }

    function applyScreenAspectRatio(val) {
        try {
            let mult = 1.0;
            if (val === 'stretched_4_3') mult = 0.75;
            else if (val === 'stretched_16_10') mult = 0.847;
            else if (val === 'square_1_1') mult = 1.333;
            window.__SW_ASPECT_MULT__ = mult;

            const canvas = document.getElementById('pixi-canvas') || document.getElementById('game-canvas') || document.querySelector('canvas');
            if (canvas) {
                canvas.style.transform = 'none';
                canvas.style.width = '100vw';
                canvas.style.height = '100vh';
                canvas.style.margin = '0';
            }
            const st = document.getElementById('sw-aspect-style');
            if (st) st.remove();

            const w = window.innerWidth || 800;
            const h = window.innerHeight || 600;
            if (window.game && window.game.camera && typeof window.game.camera.updateProjection === 'function') {
                window.game.camera.updateProjection(w, h);
            }
            if (window.game && window.game.scene && window.game.scene.camera && typeof window.game.scene.camera.updateProjection === 'function') {
                window.game.scene.camera.updateProjection(w, h);
            }
        } catch(e) {}
    }

    window.__cycleAspectRatio = function() {
        const seq = ['native', 'stretched_4_3', 'stretched_16_10', 'square_1_1'];
        const idx = seq.indexOf(String(GFX_SETTINGS.aspectRatio));
        GFX_SETTINGS.aspectRatio = seq[(idx + 1) % seq.length];
        localStorage.setItem('sw_aspect_ratio', GFX_SETTINGS.aspectRatio);
        applyScreenAspectRatio(GFX_SETTINGS.aspectRatio);
        const el = document.getElementById('val-gfx-aspectratio');
        if (el) el.textContent = getAspectRatioLabel(GFX_SETTINGS.aspectRatio);
        showHUDNotification('Proporção: ' + getAspectRatioLabel(GFX_SETTINGS.aspectRatio));
    };

    function getCoinOutlineLabel(val) {
        if (String(val) === '1') return 'Só Contorno';
        if (String(val) === '2') return 'Moeda Preta';
        return 'Desativado';
    }

    window.__toggleCoinOutline = function() {
        const seq = ['0', '1', '2'];
        const cur = String(GFX_SETTINGS.coinOutline || '0');
        const idx = seq.indexOf(cur);
        GFX_SETTINGS.coinOutline = seq[(idx + 1) % seq.length];
        localStorage.setItem('sw_coin_outline', GFX_SETTINGS.coinOutline);
        const label = getCoinOutlineLabel(GFX_SETTINGS.coinOutline);
        const el = document.getElementById('val-gfx-coinoutline');
        if (el) el.textContent = label;
        showHUDNotification('Estilo das Moedas: ' + label);
    };

    window.__setSaturation = function(val) {
        GFX_SETTINGS.saturation = Math.max(50, Math.min(300, parseInt(val, 10) || 100));
        localStorage.setItem('sw_saturation', String(GFX_SETTINGS.saturation));
        document.documentElement.style.setProperty('--game-saturation', GFX_SETTINGS.saturation + '%');

        const canvas = document.querySelector('#game-canvas') || (window.app && window.app.view) || document.querySelector('canvas');
        if (canvas) {
            applyCanvasGraphicsFilter(canvas, GFX_SETTINGS.saturation, GFX_SETTINGS.contrast);
        }

        const el = document.getElementById('val-gfx-saturation');
        if (el) {
            let desc = GFX_SETTINGS.saturation + '%';
            if (GFX_SETTINGS.saturation === 100) desc += ' (Padrão)';
            else if (GFX_SETTINGS.saturation >= 200) desc += ' (Ultra Vívido)';
            else if (GFX_SETTINGS.saturation >= 150) desc += ' (Intenso)';
            else if (GFX_SETTINGS.saturation <= 75) desc += ' (Suave)';
            el.textContent = desc;
        }
        const s = document.getElementById('slider-saturation');
        if (s && s.value != GFX_SETTINGS.saturation) s.value = GFX_SETTINGS.saturation;
    };

    window.__setContrast = function(val) {
        GFX_SETTINGS.contrast = Math.max(50, Math.min(300, parseInt(val, 10) || 100));
        localStorage.setItem('sw_contrast', String(GFX_SETTINGS.contrast));
        document.documentElement.style.setProperty('--game-contrast', GFX_SETTINGS.contrast + '%');

        const canvas = document.querySelector('#game-canvas') || (window.app && window.app.view) || document.querySelector('canvas');
        if (canvas) {
            applyCanvasGraphicsFilter(canvas, GFX_SETTINGS.saturation, GFX_SETTINGS.contrast);
        }

        const el = document.getElementById('val-gfx-contrast');
        if (el) {
            let desc = GFX_SETTINGS.contrast + '%';
            if (GFX_SETTINGS.contrast === 100) desc += ' (Padrão)';
            else if (GFX_SETTINGS.contrast >= 200) desc += ' (Forte)';
            else if (GFX_SETTINGS.contrast >= 140) desc += ' (Alto)';
            el.textContent = desc;
        }
        const s = document.getElementById('slider-contrast');
        if (s && s.value != GFX_SETTINGS.contrast) s.value = GFX_SETTINGS.contrast;
    };

    window.__setGameVolume = function(val) {
        GFX_SETTINGS.volume = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
        localStorage.setItem('sw_volume', String(GFX_SETTINGS.volume));
        applyGameVolume(GFX_SETTINGS.volume);
        const el = document.getElementById('val-gfx-volume');
        if (el) {
            el.textContent = GFX_SETTINGS.volume === 0 ? 'Mudo (0%)' : (GFX_SETTINGS.volume + '%' + (GFX_SETTINGS.volume === 30 ? ' (Padrão)' : ''));
        }
        const s = document.getElementById('slider-volume');
        if (s && s.value != GFX_SETTINGS.volume) s.value = GFX_SETTINGS.volume;
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

    // Continuous unlock maintenance (low-frequency check, zero frame impact)
    setInterval(() => {
        if (!window.UNLIMITED_MODE) return;
        applyUnlimitedStorage();
        if (window.app && window.app.user) {
            applyUnlockToUser(window.app.user);
        }
        if (window.app && window.app.shop) {
            patchShopItems(window.app.shop);
        }
    }, 4000);

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
    const coinShatterFragments = [];
    window.__dashSpeedMult = 1.0;

    function setEntityHexColor(obj, hexColor) {
        if (!obj) return;
        try {
            const view = obj.view3d || obj;
            const source = view && view.material;
            const materials = Array.isArray(source) ? source : (source ? [source] : []);
            for (const material of materials) if (material) material.color = hexColor;
            const children = obj.children || (obj.container && obj.container.children);
            if (children && children.length) {
                for (let i = 0; i < children.length; i++) {
                    setEntityHexColor(children[i], hexColor);
                }
            }
        } catch(e) {}
    }

    // Run-scoped hoverboard energy: it is earned by surviving and never leaks
    // between runs. The skate is unlimited once the player fills the meter.
    const ENERGY_MAX = 8;
    let skateEnergy = 0;
    let lastEnergyTickTime = 0;
    const ENERGY_INTERVAL_MS = 10000;
    let energyGateInstalled = false;
    let energyCoinBlueTexture = null;
    let trampolinePadTexture = null;
    let pilowGeometry = null;
    const pilowGeometryReady = loadPilowGeometry().then(data => { pilowGeometry = data; return data; }).catch(() => null);

    function multiplyMatrix4(a, b) {
        const out = new Float32Array(16);
        for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
            out[col * 4 + row] = sum;
        }
        return out;
    }

    function localNodeMatrix(node) {
        if (node.matrix && node.matrix.length === 16) return new Float32Array(node.matrix);
        const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
        const [sx, sy, sz] = node.scale || [1, 1, 1];
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;
        const [tx, ty, tz] = node.translation || [0, 0, 0];
        return new Float32Array([
            (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
            (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
            (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
            tx, ty, tz, 1
        ]);
    }

    async function loadPilowGeometry() {
        const response = await fetch(new URL('assets/pilow.glb', window.location.href).href, { cache: 'force-cache' });
        if (!response.ok) throw new Error('Could not load pilow.glb');
        const bytes = await response.arrayBuffer();
        const view = new DataView(bytes);
        if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB header');
        const jsonLength = view.getUint32(12, true);
        const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)).trim());
        const binaryHeader = 20 + jsonLength;
        const binaryLength = view.getUint32(binaryHeader, true);
        const binary = new Uint8Array(bytes, binaryHeader + 8, binaryLength);
        const meshNode = (gltf.nodes || []).find(node => Number.isInteger(node.mesh));
        if (!meshNode) throw new Error('No mesh in pilow.glb');
        const primitive = gltf.meshes[meshNode.mesh].primitives[0];
        const readAccessor = accessorIndex => {
            const accessor = gltf.accessors[accessorIndex];
            const bufferView = gltf.bufferViews[accessor.bufferView];
            const componentInfo = ({ 5121: [1, Uint8Array], 5123: [2, Uint16Array], 5125: [4, Uint32Array], 5126: [4, Float32Array] })[accessor.componentType];
            const componentCount = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 })[accessor.type];
            if (!componentInfo || !componentCount) throw new Error('Unsupported pilow geometry format');
            const [componentBytes, TypedArray] = componentInfo;
            const stride = bufferView.byteStride || componentBytes * componentCount;
            const base = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
            const result = new TypedArray(accessor.count * componentCount);
            for (let row = 0; row < accessor.count; row++) for (let col = 0; col < componentCount; col++) {
                const offset = base + row * stride + col * componentBytes;
                let value;
                if (accessor.componentType === 5126) value = new DataView(binary.buffer, binary.byteOffset, binary.byteLength).getFloat32(offset, true);
                else if (accessor.componentType === 5125) value = new DataView(binary.buffer, binary.byteOffset, binary.byteLength).getUint32(offset, true);
                else if (accessor.componentType === 5123) value = new DataView(binary.buffer, binary.byteOffset, binary.byteLength).getUint16(offset, true);
                else value = binary[offset];
                result[row * componentCount + col] = value;
            }
            return { data: result, count: componentCount };
        };
        const positions = readAccessor(primitive.attributes.POSITION).data;
        const normals = primitive.attributes.NORMAL === undefined ? null : readAccessor(primitive.attributes.NORMAL).data;
        const uvs = primitive.attributes.TEXCOORD_0 === undefined ? null : readAccessor(primitive.attributes.TEXCOORD_0).data;
        const indicesRaw = readAccessor(primitive.indices).data;

        const parents = new Map();
        (gltf.nodes || []).forEach((node, index) => (node.children || []).forEach(child => parents.set(child, index)));
        let worldMatrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        const chain = [];
        let nodeIndex = gltf.nodes.indexOf(meshNode);
        while (nodeIndex !== -1) { chain.unshift(nodeIndex); nodeIndex = parents.has(nodeIndex) ? parents.get(nodeIndex) : -1; }
        for (const index of chain) worldMatrix = multiplyMatrix4(worldMatrix, localNodeMatrix(gltf.nodes[index]));

        const transformed = new Float32Array(positions.length);
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i], y = positions[i + 1], z = positions[i + 2];
            const tx = worldMatrix[0] * x + worldMatrix[4] * y + worldMatrix[8] * z + worldMatrix[12];
            const ty = worldMatrix[1] * x + worldMatrix[5] * y + worldMatrix[9] * z + worldMatrix[13];
            const tz = worldMatrix[2] * x + worldMatrix[6] * y + worldMatrix[10] * z + worldMatrix[14];
            transformed[i] = tx; transformed[i + 1] = ty; transformed[i + 2] = tz;
            min[0] = Math.min(min[0], tx); min[1] = Math.min(min[1], ty); min[2] = Math.min(min[2], tz);
            max[0] = Math.max(max[0], tx); max[1] = Math.max(max[1], ty); max[2] = Math.max(max[2], tz);
        }
        const center = min.map((value, axis) => (value + max[axis]) / 2);
        for (let i = 0; i < transformed.length; i += 3) {
            transformed[i] -= center[0]; transformed[i + 1] -= min[1]; transformed[i + 2] -= center[2];
        }
        const transformedNormals = normals && new Float32Array(normals.length);
        if (normals) for (let i = 0; i < normals.length; i += 3) {
            let nx = worldMatrix[0] * normals[i] + worldMatrix[4] * normals[i + 1] + worldMatrix[8] * normals[i + 2];
            let ny = worldMatrix[1] * normals[i] + worldMatrix[5] * normals[i + 1] + worldMatrix[9] * normals[i + 2];
            let nz = worldMatrix[2] * normals[i] + worldMatrix[6] * normals[i + 1] + worldMatrix[10] * normals[i + 2];
            const length = Math.hypot(nx, ny, nz) || 1;
            transformedNormals[i] = nx / length; transformedNormals[i + 1] = ny / length; transformedNormals[i + 2] = nz / length;
        }
        return {
            positions: transformed,
            normals: transformedNormals,
            uvs,
            indices: new Uint16Array(indicesRaw),
            topY: max[1] - min[1],
            width: Math.max(max[0] - min[0], max[2] - min[2])
        };
    }

    function applyPilowGeometry(entity, data) {
        if (!entity || !data) return false;
        const pending = [entity];
        while (pending.length) {
            const node = pending.shift();
            const mesh = node && node.view3d;
            const sourceGeometry = mesh && mesh.geometry;
            if (sourceGeometry && typeof sourceGeometry.addAttribute === 'function' && typeof sourceGeometry.addIndex === 'function') {
                const GeometryClass = sourceGeometry.constructor;
                const geometry = new GeometryClass();
                geometry.addAttribute('aPosition', data.positions, 3);
                if (data.normals) geometry.addAttribute('aNormal', data.normals, 3);
                if (data.uvs) geometry.addAttribute('aUv', data.uvs, 2);
                geometry.addIndex(data.indices);
                mesh.geometry = geometry;
                // The GLB's embedded image is only a white metallic/roughness
                // map. Give the pillow its actual fabric/albedo texture and a
                // neutral material so it cannot render as a black silhouette.
                applyTrampolinePadTexture(entity);
                const material = mesh.material;
                if (material) {
                    material.color = 0xffffff;
                    material.emissive = 0x321018;
                    material.emissiveColor = 0x321018;
                    material.emissionColor = 0x321018;
                    material.emission = 0.2;
                    material.emissiveIntensity = 0.2;
                }
                return true;
            }
            const children = node && (node.children || (node.container && node.container.children));
            if (children) for (let i = 0; i < children.length; i++) pending.push(children[i]);
        }
        return false;
    }

    let energyCoinGeoCache = null;

    function createEnergyCoinAtlas(TextureClass) {
        if (energyCoinBlueTexture) return energyCoinBlueTexture;
        try {
            if (typeof document !== 'undefined' && TextureClass && typeof TextureClass.from === 'function') {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // TL (0..128, 0..128): Glowing energy plasma core disc
                    const gCore = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
                    gCore.addColorStop(0.0, '#ffffff');
                    gCore.addColorStop(0.28, '#8df8ff');
                    gCore.addColorStop(0.62, '#1498ff');
                    gCore.addColorStop(0.88, '#083a8f');
                    gCore.addColorStop(1.0, '#04163d');
                    ctx.fillStyle = gCore;
                    ctx.fillRect(0, 0, 128, 128);
                    ctx.strokeStyle = 'rgba(185, 249, 255, 0.72)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(64, 64, 42, 0, Math.PI * 2);
                    ctx.stroke();

                    // TR (128..256, 0..128): Brushed chrome-sapphire beveled frame
                    const gRim = ctx.createLinearGradient(128, 0, 256, 128);
                    gRim.addColorStop(0.0, '#9aefff');
                    gRim.addColorStop(0.32, '#1c63c7');
                    gRim.addColorStop(0.65, '#0b2256');
                    gRim.addColorStop(1.0, '#4dd2ff');
                    ctx.fillStyle = gRim;
                    ctx.fillRect(128, 0, 128, 128);
                    ctx.fillStyle = 'rgba(215, 252, 255, 0.45)';
                    for (let k = 0; k < 4; k++) ctx.fillRect(128 + k * 32, 46, 14, 36);

                    // BL (0..128, 128..256): High-contrast 3D extruded lightning crystal
                    const gBolt = ctx.createLinearGradient(0, 128, 128, 256);
                    gBolt.addColorStop(0.0, '#ffffff');
                    gBolt.addColorStop(0.5, '#c7fcff');
                    gBolt.addColorStop(1.0, '#3fdcff');
                    ctx.fillStyle = gBolt;
                    ctx.fillRect(0, 128, 128, 128);

                    // BR (128..256, 128..256): Orbital gyro ring with plasma segments
                    const gRing = ctx.createLinearGradient(128, 128, 256, 256);
                    gRing.addColorStop(0.0, '#3ec8ff');
                    gRing.addColorStop(0.45, '#b8faff');
                    gRing.addColorStop(0.75, '#7e6bff');
                    gRing.addColorStop(1.0, '#2ab4ff');
                    ctx.fillStyle = gRing;
                    ctx.fillRect(128, 128, 128, 128);

                    energyCoinBlueTexture = TextureClass.from(canvas);
                }
            }
            if (!energyCoinBlueTexture && TextureClass && typeof TextureClass.from === 'function') {
                energyCoinBlueTexture = TextureClass.from(new URL('assets/energy-coin-blue.svg', window.location.href).href);
            }
        } catch(e) {}
        return energyCoinBlueTexture;
    }

    function getEnergyCoinBlueTexture() {
        if (energyCoinBlueTexture) return energyCoinBlueTexture;
        try {
            const origMap = window.__lib && window.__lib.getMap && window.__lib.getMap('props-tex');
            return createEnergyCoinAtlas(origMap && origMap.constructor);
        } catch(e) { return null; }
    }

    let boostCoinGreenTexture = null;
    function createBoostCoinAtlas(TextureClass) {
        if (boostCoinGreenTexture) return boostCoinGreenTexture;
        try {
            if (typeof document !== 'undefined') {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const gCore = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
                    gCore.addColorStop(0.0, '#ffffff');
                    gCore.addColorStop(0.24, '#a3ffb8');
                    gCore.addColorStop(0.55, '#00e653');
                    gCore.addColorStop(0.85, '#006b24');
                    gCore.addColorStop(1.0, '#00260e');
                    ctx.fillStyle = gCore;
                    ctx.fillRect(0, 0, 128, 128);

                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#00ff66';
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.moveTo(68, 20); ctx.lineTo(44, 64); ctx.lineTo(62, 64);
                    ctx.lineTo(54, 108); ctx.lineTo(84, 56); ctx.lineTo(66, 56);
                    ctx.closePath();
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    const gRim = ctx.createLinearGradient(128, 0, 256, 128);
                    gRim.addColorStop(0.0, '#85ffab');
                    gRim.addColorStop(0.4, '#00c749');
                    gRim.addColorStop(0.8, '#004719');
                    gRim.addColorStop(1.0, '#2eff7b');
                    ctx.fillStyle = gRim;
                    ctx.fillRect(128, 0, 128, 128);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    for (let k = 0; k < 5; k++) ctx.fillRect(132 + k * 24, 48, 12, 32);

                    ctx.fillStyle = '#003814';
                    ctx.fillRect(0, 128, 128, 128);
                    ctx.fillStyle = '#00ff66';
                    for (let c = 0; c < 2; c++) {
                        const ox = 26 + c * 38;
                        ctx.beginPath();
                        ctx.moveTo(ox, 150); ctx.lineTo(ox + 22, 192); ctx.lineTo(ox, 234);
                        ctx.lineTo(ox + 16, 234); ctx.lineTo(ox + 38, 192); ctx.lineTo(ox + 16, 150);
                        ctx.closePath();
                        ctx.fill();
                    }

                    const gRing = ctx.createLinearGradient(128, 128, 256, 256);
                    gRing.addColorStop(0.0, '#00ff73');
                    gRing.addColorStop(0.5, '#7dffb3');
                    gRing.addColorStop(1.0, '#009938');
                    ctx.fillStyle = gRing;
                    ctx.fillRect(128, 128, 128, 128);

                    boostCoinGreenTexture = TextureClass.from(canvas);
                }
            }
        } catch(e) {}
        return boostCoinGreenTexture;
    }

    function getBoostCoinGreenTexture() {
        if (boostCoinGreenTexture) return boostCoinGreenTexture;
        try {
            const origMap = window.__lib && window.__lib.getMap && window.__lib.getMap('props-tex');
            return createBoostCoinAtlas(origMap && origMap.constructor);
        } catch(e) { return null; }
    }

    function applyBoostCoinTexture(mesh) {
        try {
            const tex = getBoostCoinGreenTexture();
            if (!mesh || !tex) return false;
            let applied = false;
            const visit = obj => {
                if (!obj) return;
                const view = obj.view3d || obj;
                if (view && view.material) {
                    const source = view.material;
                    const cloneMat = m => {
                        if (!m) return m;
                        if (m._isBoostMat) return m;
                        const cloned = (typeof m.clone === 'function') ? m.clone() : Object.assign(Object.create(Object.getPrototypeOf(m)), m);
                        cloned.diffuseMap = tex;
                        if ('map' in cloned) cloned.map = tex;
                        cloned.color = 0xffffff;
                        cloned.emissive = 0x00471a;
                        cloned.emissiveIntensity = 0.35;
                        cloned._isBoostMat = true;
                        return cloned;
                    };
                    view.material = Array.isArray(source) ? source.map(cloneMat) : cloneMat(source);
                    applied = true;
                }
                const children = obj.children || (obj.container && obj.container.children);
                if (children && children.length) {
                    for (let i = 0; i < children.length; i++) visit(children[i]);
                }
            };
            visit(mesh);
            return applied;
        } catch(e) { return false; }
    }

    function restoreCoinNativeTexture(mesh, isNoCoin) {
        if (!mesh) return;
        const propsMap = (window.__lib && window.__lib.getMap && window.__lib.getMap('props-tex')) || null;
        const visit = obj => {
            if (!obj) return;
            const view = obj.view3d || obj;
            if (view && view.material) {
                const mats = Array.isArray(view.material) ? view.material : [view.material];
                for (const m of mats) {
                    if (!m) continue;
                    if (!m._origMap && (m.diffuseMap || m.map)) {
                        m._origMap = m.diffuseMap || m.map;
                    }
                    const targetMap = m._origMap || propsMap;
                    if (targetMap) {
                        m.diffuseMap = targetMap;
                        if ('map' in m) m.map = targetMap;
                    }
                    if (isNoCoin) {
                        m.color = 0xff1e28;
                        m.emissive = 0x380008;
                        m.emissiveIntensity = 0.32;
                    } else {
                        m.color = 0xffffff;
                        m.emissive = 0x000000;
                        m.emissiveIntensity = 0;
                    }
                }
            }
            const children = obj.children || (obj.container && obj.container.children);
            if (children && children.length) {
                for (let i = 0; i < children.length; i++) visit(children[i]);
            }
        };
        visit(mesh);
    }

    function buildBoostCoinModel() {
        if (!window.__lib || !window.__lib.getEntity) return null;
        let face, ring;
        try {
            face = window.__lib.getEntity('currency_coin');
            ring = window.__lib.getEntity('currency_coin');
        } catch(e) { return face || null; }
        if (!face) return null;
        face.rx = 0; face.ry = 0; face.rz = 0;
        if (face.scale) face.scale.set(1, 1, 1);

        let protoView = null;
        let protoChildScale = 1;
        {
            const q = [{ node: face, s: 1 }];
            while (q.length) {
                const cur = q.shift();
                const c = cur.node;
                const sc = cur.s * (c && c.scale && Number.isFinite(c.scale.x) ? c.scale.x : 1);
                if (c && c.view3d && c.view3d.geometry) {
                    protoView = c.view3d;
                    protoChildScale = sc;
                    break;
                }
                const ch = c && (c.children || (c.container && c.container.children));
                if (ch) for (let i = 0; i < ch.length; i++) q.push({ node: ch[i], s: sc });
            }
        }
        const geos = protoView ? buildEnergyCoinGeometries(protoView, protoChildScale) : null;
        if (geos) {
            setFirstViewGeometry(face, geos.coreGeom);
            if (ring) setFirstViewGeometry(ring, geos.ringGeom);
        }
        applyBoostCoinTexture(face);

        if (ring) {
            ring.rx = 0.42; ring.ry = 0; ring.rz = 0.24;
            if (ring.scale) ring.scale.set(1.06, 1.06, 1.06);
            applyBoostCoinTexture(ring);
            face.addChild(ring);
        }
        return face;
    }

    window.__SW_GET_JOHNSURF_TEX__ = function() {
        if (window.__SW_JOHNSURF_LOGO_TEX__) return window.__SW_JOHNSURF_LOGO_TEX__;
        try {
            const lib = window.__lib || (window.app && window.app.library);
            const ref = lib && lib.getMap && (lib.getMap('props-tex') || lib.getMap('trains-tex') || lib.getMap('shadow'));
            const TexCls = ref && ref.constructor;
            if (TexCls && typeof TexCls.from === 'function') {
                window.__SW_JOHNSURF_LOGO_TEX__ = TexCls.from(new URL('bundles/lasvegas/game-idle/train-start.png?h=johnsurf8', window.location.href).href);
                return window.__SW_JOHNSURF_LOGO_TEX__;
            }
        } catch(e) {}
        return null;
    };

    function enforceTrainStartLogo() {
        try {
            const tex = window.__SW_GET_JOHNSURF_TEX__ && window.__SW_GET_JOHNSURF_TEX__();
            if (!tex) return;
            const roots = [
                window.app && window.app.game && window.app.game.idleScene,
                window.app && window.app.game && window.app.game.scene,
                window.game && window.game.scene
            ].filter(Boolean);
            for (const root of roots) {
                const q = [root];
                while (q.length) {
                    const node = q.shift();
                    const name = ((node.name || '') + ' ' + (node.materialName || '')).toLowerCase();
                    if (name.includes('train_start') || name.includes('train-start') || (node.view3d && node.view3d.material && name.includes('start'))) {
                        const v = node.view3d;
                        if (v && v.material) {
                            const mats = Array.isArray(v.material) ? v.material : [v.material];
                            mats.forEach(m => {
                                if (m && m.diffuseMap !== tex) {
                                    m.diffuseMap = tex;
                                    if ('map' in m) m.map = tex;
                                    m.color = 0xffffff;
                                    try { m.dirty = true; } catch(err) {}
                                }
                            });
                        }
                    }
                    const ch = node.children || (node.container && node.container.children);
                    if (ch) for (let i = 0; i < ch.length; i++) q.push(ch[i]);
                }
            }
        } catch(e) {}
    }

    function hookLibraryGetMap() {
        try {
            const lib = window.__lib || (window.app && window.app.library);
            if (lib && lib.getMap && !lib.__swHooked) {
                lib.__swHooked = true;
                const orig = lib.getMap.bind(lib);
                lib.getMap = function(name) {
                    if (name === 'train-start' || name === 'train_start') {
                        const custom = window.__SW_GET_JOHNSURF_TEX__ && window.__SW_GET_JOHNSURF_TEX__();
                        if (custom) return custom;
                    }
                    return orig(name);
                };
            }
        } catch(e) {}
    }
    try {
        hookLibraryGetMap();
        setInterval(() => {
            hookLibraryGetMap();
            enforceTrainStartLogo();
        }, 500);
    } catch(e) {}

    function applyEnergyCoinTexture(mesh) {
        try {
            if (!mesh || !window.__lib || !window.__lib.getMap) return false;
            const originalMap = window.__lib.getMap('props-tex');
            const TextureClass = originalMap && originalMap.constructor;
            const tex = createEnergyCoinAtlas(TextureClass);
            if (!tex) return false;
            let applied = false;
            const visit = obj => {
                if (!obj) return;
                const view = obj.view3d || obj;
                const source = view && view.material;
                const materials = Array.isArray(source) ? source : (source ? [source] : []);
                materials.forEach(material => {
                    if (!material) return;
                    material.diffuseMap = tex;
                    if ('map' in material) material.map = tex;
                    material.color = 0xffffff;
                    try {
                        material.emissive = 0x168dff;
                        material.emissiveColor = 0x168dff;
                        material.emission = 0.22;
                    } catch(e) {}
                    applied = true;
                });
                const children = obj.children || (obj.container && obj.container.children);
                if (children) for (let i = 0; i < children.length; i++) visit(children[i]);
            };
            visit(mesh);
            return applied;
        } catch(e) { return false; }
    }

    function buildEnergyCoinGeometries(protoView, childScale = 1) {
        if (energyCoinGeoCache) return energyCoinGeoCache;
        try {
            const baseGeom = protoView && protoView.geometry;
            if (!baseGeom || typeof baseGeom.addAttribute !== 'function') return null;
            const posBuf = baseGeom.getBuffer && baseGeom.getBuffer('aPosition');
            if (!posBuf) return null;
            const GeomCls = baseGeom.constructor;
            const BufCls = posBuf.constructor;
            const BoxCls = baseGeom.boundingBox && baseGeom.boundingBox.constructor;
            const SphereCls = baseGeom.boundingSphere && baseGeom.boundingSphere.constructor;
            const VecCls = baseGeom.boundingBox && baseGeom.boundingBox.min && baseGeom.boundingBox.min.constructor;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
            const rawData = posBuf.data;
            if (rawData && rawData.length >= 3) {
                for (let k = 0; k + 2 < rawData.length; k += 3) {
                    const vx = rawData[k], vy = rawData[k + 1], vz = rawData[k + 2];
                    if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
                    if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
                    if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
                }
            }
            const box = baseGeom.boundingBox;
            const min = isFinite(minX) ? { x: minX, y: minY, z: minZ } : (box ? box.min : { x: -2.2, y: -2.2, z: -0.45 });
            const max = isFinite(maxX) ? { x: maxX, y: maxY, z: maxZ } : (box ? box.max : { x: 2.2, y: 2.2, z: 0.45 });
            const cx = (min.x + max.x) * 0.5;
            const cy = (min.y + max.y) * 0.5;
            const cz = (min.z + max.z) * 0.5;
            const dx = Math.max(0.01, max.x - min.x);
            const dy = Math.max(0.01, max.y - min.y);
            const dz = Math.max(0.01, max.z - min.z);
            const nAxis = dx <= dy && dx <= dz ? 0 : (dy <= dz ? 1 : 2);
            const uAxis = nAxis === 0 ? 1 : 0;
            const vAxis = nAxis === 2 ? 1 : 2;
            const worldHalf = Math.max(dx, dy, dz) * 0.5 * Math.max(0.001, childScale);
            const targetWorldR = Math.max(worldHalf * 1.15, 2.75);
            const R = targetWorldR / Math.max(0.001, childScale);
            const mapPt = (lx, ly, lz) => {
                const out = [0, 0, 0];
                out[uAxis] = lx;
                out[vAxis] = ly;
                out[nAxis] = lz;
                return [cx + out[0], cy + out[1], cz + out[2]];
            };
            const mapNorm = (nx, ny, nz) => {
                const len = Math.hypot(nx, ny, nz) || 1;
                const out = [0, 0, 0];
                out[uAxis] = nx / len;
                out[vAxis] = ny / len;
                out[nAxis] = nz / len;
                return out;
            };
            const createBuilder = () => {
                const pos = [], norm = [], uv = [], idx = [];
                const pushV = (lx, ly, lz, nx, ny, nz, u, v) => {
                    const p = mapPt(lx, ly, lz);
                    const n = mapNorm(nx, ny, nz);
                    const id = pos.length / 3;
                    pos.push(p[0], p[1], p[2]);
                    norm.push(n[0], n[1], n[2]);
                    uv.push(u, v);
                    return id;
                };
                const addTri = (a, b, c, nrm, u, v) => {
                    const i0 = pushV(a[0], a[1], a[2], nrm[0], nrm[1], nrm[2], u, v);
                    const i1 = pushV(b[0], b[1], b[2], nrm[0], nrm[1], nrm[2], u, v);
                    const i2 = pushV(c[0], c[1], c[2], nrm[0], nrm[1], nrm[2], u, v);
                    idx.push(i0, i1, i2);
                };
                const addQuad = (a, b, c, d, nrm, u, v) => {
                    const i0 = pushV(a[0], a[1], a[2], nrm[0], nrm[1], nrm[2], u, v);
                    const i1 = pushV(b[0], b[1], b[2], nrm[0], nrm[1], nrm[2], u, v);
                    const i2 = pushV(c[0], c[1], c[2], nrm[0], nrm[1], nrm[2], u, v);
                    const i3 = pushV(d[0], d[1], d[2], nrm[0], nrm[1], nrm[2], u, v);
                    idx.push(i0, i1, i2, i0, i2, i3);
                };
                const finish = radiusMul => {
                    const g = new GeomCls();
                    g.addAttribute('aPosition', new BufCls(new Float32Array(pos)), 3);
                    g.addAttribute('aNormal', new BufCls(new Float32Array(norm)), 3);
                    g.addAttribute('aUv', new BufCls(new Float32Array(uv)), 2);
                    g.addIndex(new BufCls(new Uint16Array(idx)));
                    const rad = R * radiusMul;
                    if (BoxCls && VecCls) {
                        g.boundingBox = new BoxCls(new VecCls(cx - rad, cy - rad, cz - rad), new VecCls(cx + rad, cy + rad, cz + rad));
                        if (SphereCls) g.boundingSphere = g.boundingBox.getBoundingSphere(new SphereCls());
                    }
                    return g;
                };
                return { pushV, addTri, addQuad, finish };
            };

            // 1) Sculpted 16-tooth notched beveled core + recessed plasma core + 3D extruded lightning bolt
            const core = createBuilder();
            const segs = 16;
            const rInner = 0.78 * R;
            const rBevel = 0.96 * R;
            const zRimFace = 0.25 * R;
            const zRimEdge = 0.16 * R;
            const zCore = 0.12 * R;

            for (let i = 0; i < segs; i++) {
                const a0 = (i / segs) * Math.PI * 2;
                const a1 = ((i + 1) / segs) * Math.PI * 2;
                const am = (a0 + a1) * 0.5;
                const rOut0 = (i % 2 === 0 ? 1.15 : 1.01) * R;
                const rOut1 = ((i + 1) % 2 === 0 ? 1.15 : 1.01) * R;
                const c0 = Math.cos(a0), s0 = Math.sin(a0);
                const c1 = Math.cos(a1), s1 = Math.sin(a1);
                const nxOut = Math.cos(am), nyOut = Math.sin(am);

                // Recessed glowing energy disc (front & back)
                core.addTri([0, 0, zCore], [c0 * rInner, s0 * rInner, zCore], [c1 * rInner, s1 * rInner, zCore], [0, 0, 1], 0.25, 0.25);
                core.addTri([0, 0, -zCore], [c1 * rInner, s1 * rInner, -zCore], [c0 * rInner, s0 * rInner, -zCore], [0, 0, -1], 0.25, 0.25);

                // Inner core-to-rim step wall
                core.addQuad([c0 * rInner, s0 * rInner, zCore], [c0 * rInner, s0 * rInner, zRimFace], [c1 * rInner, s1 * rInner, zRimFace], [c1 * rInner, s1 * rInner, zCore], [-nxOut, -nyOut, 0.25], 0.65, 0.25);
                core.addQuad([c1 * rInner, s1 * rInner, -zCore], [c1 * rInner, s1 * rInner, -zRimFace], [c0 * rInner, s0 * rInner, -zRimFace], [c0 * rInner, s0 * rInner, -zCore], [-nxOut, -nyOut, -0.25], 0.65, 0.25);

                // Rim top face & chamfer bevel (front & back)
                core.addQuad([c0 * rInner, s0 * rInner, zRimFace], [c0 * rBevel, s0 * rBevel, zRimFace], [c1 * rBevel, s1 * rBevel, zRimFace], [c1 * rInner, s1 * rInner, zRimFace], [0, 0, 1], 0.72, 0.22);
                core.addQuad([c0 * rBevel, s0 * rBevel, zRimFace], [c0 * rOut0, s0 * rOut0, zRimEdge], [c1 * rOut1, s1 * rOut1, zRimEdge], [c1 * rBevel, s1 * rBevel, zRimFace], [nxOut * 0.55, nyOut * 0.55, 0.84], 0.85, 0.30);

                core.addQuad([c1 * rInner, s1 * rInner, -zRimFace], [c1 * rBevel, s1 * rBevel, -zRimFace], [c0 * rBevel, s0 * rBevel, -zRimFace], [c0 * rInner, s0 * rInner, -zRimFace], [0, 0, -1], 0.72, 0.22);
                core.addQuad([c1 * rBevel, s1 * rBevel, -zRimFace], [c1 * rOut1, s1 * rOut1, -zRimEdge], [c0 * rOut0, s0 * rOut0, -zRimEdge], [c0 * rBevel, s0 * rBevel, -zRimFace], [nxOut * 0.55, nyOut * 0.55, -0.84], 0.85, 0.30);

                // Thick gear-notched outer rim wall
                core.addQuad([c0 * rOut0, s0 * rOut0, zRimEdge], [c0 * rOut0, s0 * rOut0, -zRimEdge], [c1 * rOut1, s1 * rOut1, -zRimEdge], [c1 * rOut1, s1 * rOut1, zRimEdge], [nxOut, nyOut, 0], 0.88, 0.20);
            }

            // 4 raised turbine stabilizer ribs connecting rim & plasma core
            const strutT = 0.075 * R, zStrut = 0.17 * R;
            for (let k = 0; k < 4; k++) {
                const ang = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
                const ux = Math.cos(ang), uy = Math.sin(ang);
                const vx = -uy, vy = ux;
                const rA = 0.34 * R, rB = 0.74 * R;
                const aF = [ux * rA - vx * strutT, uy * rA - vy * strutT, zStrut];
                const bF = [ux * rA + vx * strutT, uy * rA + vy * strutT, zStrut];
                const cF = [ux * rB + vx * strutT, uy * rB + vy * strutT, zStrut];
                const dF = [ux * rB - vx * strutT, uy * rB - vy * strutT, zStrut];
                core.addQuad(aF, bF, cF, dF, [0, 0, 1], 0.80, 0.28);
                core.addQuad([aF[0], aF[1], -zStrut], [dF[0], dF[1], -zStrut], [cF[0], cF[1], -zStrut], [bF[0], bF[1], -zStrut], [0, 0, -1], 0.80, 0.28);
            }

            // Double-sided protruding 3D Lightning Bolt crystal
            const boltScale = R * 0.68;
            const zBoltTip = 0.41 * R;
            const boltTris = [
                [[0.12, 1.00], [-0.46, 0.08], [0.02, 0.08]],
                [[0.12, 1.00], [0.02, 0.08], [0.34, 0.34]],
                [[0.02, 0.08], [-0.46, 0.08], [-0.04, -0.08]],
                [[0.02, 0.08], [-0.04, -0.08], [0.52, -0.08]],
                [[0.52, -0.08], [-0.04, -0.08], [-0.14, -1.00]],
                [[0.02, 0.08], [0.52, -0.08], [-0.14, -1.00]]
            ];
            for (const tri of boltTris) {
                const a = [tri[0][0] * boltScale, tri[0][1] * boltScale, zBoltTip];
                const b = [tri[1][0] * boltScale, tri[1][1] * boltScale, zBoltTip];
                const c = [tri[2][0] * boltScale, tri[2][1] * boltScale, zBoltTip];
                core.addTri(a, b, c, [0, 0, 1], 0.22, 0.76);
                core.addTri([a[0], a[1], -zBoltTip], [c[0], c[1], -zBoltTip], [b[0], b[1], -zBoltTip], [0, 0, -1], 0.22, 0.76);
            }
            const boltRing = [
                [0.12, 1.00], [0.34, 0.34], [0.02, 0.08], [0.52, -0.08],
                [-0.14, -1.00], [-0.04, -0.08], [-0.46, 0.08]
            ];
            for (let i = 0; i < boltRing.length; i++) {
                const p0 = boltRing[i];
                const p1 = boltRing[(i + 1) % boltRing.length];
                const ex = (p1[0] - p0[0]) * boltScale;
                const ey = (p1[1] - p0[1]) * boltScale;
                const x0 = p0[0] * boltScale, y0 = p0[1] * boltScale;
                const x1 = p1[0] * boltScale, y1 = p1[1] * boltScale;
                core.addQuad([x0, y0, zBoltTip], [x0, y0, -zBoltTip], [x1, y1, -zBoltTip], [x1, y1, zBoltTip], [ey, -ex, 0], 0.16, 0.78);
            }

            // 2) Tilted 3D Torus Gyro-Ring (24x8 segments)
            const ring = createBuilder();
            const majSeg = 24, minSeg = 8;
            const majR = 1.40 * R, minR = 0.11 * R;
            for (let i = 0; i < majSeg; i++) {
                const u0 = (i / majSeg) * Math.PI * 2;
                const u1 = ((i + 1) / majSeg) * Math.PI * 2;
                const cu0 = Math.cos(u0), su0 = Math.sin(u0);
                const cu1 = Math.cos(u1), su1 = Math.sin(u1);
                for (let j = 0; j < minSeg; j++) {
                    const v0 = (j / minSeg) * Math.PI * 2;
                    const v1 = ((j + 1) / minSeg) * Math.PI * 2;
                    const pt = (cu, su, v) => {
                        const cv = Math.cos(v), sv = Math.sin(v);
                        const rr = majR + minR * cv;
                        return {
                            p: [cu * rr, su * rr, minR * sv],
                            n: [cu * cv, su * cv, sv]
                        };
                    };
                    const q00 = pt(cu0, su0, v0);
                    const q10 = pt(cu1, su1, v0);
                    const q11 = pt(cu1, su1, v1);
                    const q01 = pt(cu0, su0, v1);
                    ring.addQuad(q00.p, q10.p, q11.p, q01.p, q00.n, 0.76, 0.76);
                }
            }

            // 3) Ground contact shadow disc (flat XZ quad in local space)
            const shadowB = createBuilder();
            const sR = 2.4 * R;
            shadowB.addQuad([-sR, -sR, 0], [sR, -sR, 0], [sR, sR, 0], [-sR, sR, 0], [0, 0, 1], 0.5, 0.5);
            // Replace push with explicit UVs [0..1] for full shadow gradient sampling
            const shadowGeom = new GeomCls();
            shadowGeom.addAttribute('aPosition', new BufCls(new Float32Array([-sR, 0, -sR,  sR, 0, -sR,  sR, 0, sR,  -sR, 0, sR])), 3);
            shadowGeom.addAttribute('aNormal', new BufCls(new Float32Array([0,1,0, 0,1,0, 0,1,0, 0,1,0])), 3);
            shadowGeom.addAttribute('aUv', new BufCls(new Float32Array([0,0, 1,0, 1,1, 0,1])), 2);
            shadowGeom.addIndex(new BufCls(new Uint16Array([0, 1, 2, 0, 2, 3])));
            if (BoxCls && VecCls) {
                shadowGeom.boundingBox = new BoxCls(new VecCls(-sR, -0.5, -sR), new VecCls(sR, 0.5, sR));
                if (SphereCls) shadowGeom.boundingSphere = shadowGeom.boundingBox.getBoundingSphere(new SphereCls());
            }
            void(shadowB);

            energyCoinGeoCache = { coreGeom: core.finish(1.22), ringGeom: ring.finish(1.56), shadowGeom };
            return energyCoinGeoCache;
        } catch(e) { return null; }
    }

    function setFirstViewGeometry(entity, geom) {
        if (!entity || !geom) return false;
        const queue = [entity];
        while (queue.length) {
            const cur = queue.shift();
            const view = cur && cur.view3d;
            if (view && view.geometry) {
                view.geometry = geom;
                return view;
            }
            const children = cur && (cur.children || (cur.container && cur.container.children));
            if (children) for (let i = 0; i < children.length; i++) queue.push(children[i]);
        }
        return false;
    }

    function buildEnergyCoinModel() {
        if (!window.__lib || !window.__lib.getEntity) return null;
        let face, ring;
        try {
            face = window.__lib.getEntity('currency_coin');
            ring = window.__lib.getEntity('currency_coin');
        } catch(e) { return face || null; }
        if (!face) return null;
        face.rx = 0; face.ry = 0; face.rz = 0;
        if (face.scale) face.scale.set(1, 1, 1);

        let protoView = null;
        let protoChildScale = 1;
        {
            const q = [{ node: face, s: 1 }];
            while (q.length) {
                const cur = q.shift();
                const c = cur.node;
                const sc = cur.s * (c && c.scale && Number.isFinite(c.scale.x) ? c.scale.x : 1);
                if (c && c.view3d && c.view3d.geometry) {
                    protoView = c.view3d;
                    protoChildScale = sc;
                    break;
                }
                const ch = c && (c.children || (c.container && c.container.children));
                if (ch) for (let i = 0; i < ch.length; i++) q.push({ node: ch[i], s: sc });
            }
        }
        const geos = protoView ? buildEnergyCoinGeometries(protoView, protoChildScale) : null;
        if (geos) {
            setFirstViewGeometry(face, geos.coreGeom);
            if (ring) setFirstViewGeometry(ring, geos.ringGeom);
        }
        applyEnergyCoinTexture(face);

        const parts = [];
        if (ring) {
            ring.rx = 0.42; ring.ry = 0; ring.rz = 0.24;
            if (ring.scale) ring.scale.set(1.03, 1.03, 1.03);
            applyEnergyCoinTexture(ring);
            ring._energyCoinDepthOffset = 0;
            ring._energyCoinRing = true;
            parts.push(ring);
        }
        face._energyCoinParts = parts;
        return face;
    }

    function applyTrampolinePadTexture(mesh) {
        try {
            if (!mesh || !window.__lib || !window.__lib.getMap) return false;
            const originalMap = window.__lib.getMap('props-tex');
            const TextureClass = originalMap && originalMap.constructor;
            if (!trampolinePadTexture && TextureClass && typeof TextureClass.from === 'function') {
                trampolinePadTexture = TextureClass.from(new URL('assets/trampoline-pad.svg', window.location.href).href);
            }
            if (!trampolinePadTexture) return false;
            let applied = false;
            const visit = obj => {
                if (!obj) return;
                const view = obj.view3d || obj;
                const source = view && view.material;
                const materials = Array.isArray(source) ? source : (source ? [source] : []);
                materials.forEach(material => {
                    if (!material) return;
                    material.diffuseMap = trampolinePadTexture;
                    if ('map' in material) material.map = trampolinePadTexture;
                    material.color = 0xffffff;
                    applied = true;
                });
                const children = obj.children || (obj.container && obj.container.children);
                if (children) for (let i = 0; i < children.length; i++) visit(children[i]);
            };
            visit(mesh);
            return applied;
        } catch(e) { return false; }
    }

    function showEnergyToast(message) {
        let toast = document.getElementById('subway-energy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'subway-energy-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('visible');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove('visible'), 1300);
    }

    function updateEnergyHud() {
        const widget = document.getElementById('subway-energy-widget');
        if (!widget) return;
        const g = window.game || (window.app && window.app.game);
        const hero = g && g.hero;
        const isRunning = !!(g && g.state === 1);
        const isDead = deathFrozen || !isRunActive || !isRunning || (hero && hero.player && hero.player.dead);
        const isPaused = window.isGamePaused || !isRunning || !!(g && (g.state === 0 || g.state === 2 || (g.hud && g.hud.paused && g.hud.paused.isOpen)));
        const inMenu = document.body.classList.contains('sw-hub-visible') || !!document.getElementById('modal-unified-menu');
        const showWidget = isRunActive && isRunning && !isDead && !isPaused && !inMenu;
        widget.style.display = showWidget ? '' : 'none';
        if (!showWidget) return;
        const fill = document.getElementById('subway-energy-fill');
        if (fill) fill.style.width = `${(skateEnergy / ENERGY_MAX) * 100}%`;
        const board = hero && hero.hoverboard;
        const active = !!(board && board.isOn && board.isOn());
        widget.querySelectorAll('.energy-segment').forEach((segment, index) => {
            segment.classList.toggle('charged', index < skateEnergy);
        });
        widget.classList.toggle('is-ready', skateEnergy >= ENERGY_MAX);
        widget.classList.toggle('is-active', active);
        if (hero && hero.jump && hero.jump.enableDoubleJump) {
            if (active) hero.jump.enableDoubleJump();
        }
        widget.setAttribute('aria-label', active ? 'Energia do skate carregando enquanto ativo' : 'Energia do skate');
    }

    function grantEnergy(amount = 1) {
        const hero = window.game && window.game.hero;
        const board = hero && hero.hoverboard;
        if (board && board.isOn && board.isOn()) {
            board.count = Math.min((board.count || 0) + amount * 1.2, (board.duration || 30) + 12);
        }
        if (skateEnergy < ENERGY_MAX) {
            skateEnergy = Math.min(ENERGY_MAX, skateEnergy + amount);
            updateEnergyHud();
            if (skateEnergy >= ENERGY_MAX) showEnergyToast('SKATE PRONTO');
        } else if (board && board.isOn && board.isOn()) {
            updateEnergyHud();
        }
    }

    function installHoverboardEnergyGate() {
        const board = window.game && window.game.hero && window.game.hero.hoverboard;
        if (!board || board.__energyGate || typeof board.turnOn !== 'function') return;
        const originalTurnOn = board.turnOn;
        board.turnOn = function() {
            if (!this.__energyPermit) {
                if (skateEnergy >= ENERGY_MAX) activateBoard();
                else showEnergyToast(`ENERGIA ${skateEnergy}/${ENERGY_MAX}`);
                return;
            }
            return originalTurnOn.apply(this, arguments);
        };
        if (typeof board.onDoubleTap === 'function' && !board.__energyDoubleTapGate) {
            const originalDoubleTap = board.onDoubleTap;
            board.onDoubleTap = function() {
                if (this.__energyPermit) return originalDoubleTap.apply(this, arguments);
                if (this.isOn && this.isOn()) return;
                if (skateEnergy >= ENERGY_MAX) activateBoard();
                else showEnergyToast(`ENERGIA ${skateEnergy}/${ENERGY_MAX}`);
            };
            board.__energyDoubleTapGate = true;
        }
        board.__energyGate = true;
        energyGateInstalled = true;
    }

    function activateBoard() {
        const game = window.game;
        const hero = game && game.hero;
        const board = hero && hero.hoverboard;
        // Let the game's own turnOn() validate its current state. State enum
        // values differ between game builds, so hard-coding a number can
        // silently make the standard mobile button appear unresponsive.
        if (!game || !hero || !board) return;
        if (board.isOn && board.isOn()) return;
        if (skateEnergy < ENERGY_MAX) {
            showEnergyToast(`${skateEnergy}/${ENERGY_MAX} CARGAS`);
            return;
        }
        installHoverboardEnergyGate();
        skateEnergy = 0;
        updateEnergyHud();
        const oldNoCoin = window.NO_COIN_MODE;
        const oldLocked = board.locked;
        const oldHas = board.hasHoverboards;
        const oldSpend = board.spendHoverboard;
        const oldPlayerLock = hero.player && hero.player.hoverboardLocked;
        try {
            window.NO_COIN_MODE = false;
            board.locked = false;
            if (hero.player) hero.player.hoverboardLocked = false;
            board.hasHoverboards = () => true;
            board.spendHoverboard = () => {};
            board.__energyPermit = true;
            board.turnOn();
            if (hero.jump && hero.jump.enableDoubleJump) hero.jump.enableDoubleJump();
            if (!board.isOn || !board.isOn()) {
                skateEnergy = ENERGY_MAX;
                showEnergyToast('NÃO FOI POSSÍVEL ATIVAR');
            } else {
                showEnergyToast('SKATE ATIVADO');
            }
        } catch(e) {
            skateEnergy = ENERGY_MAX;
            showEnergyToast('NÃO FOI POSSÍVEL ATIVAR');
        } finally {
            board.__energyPermit = false;
            window.NO_COIN_MODE = oldNoCoin;
            board.locked = oldLocked;
            if (hero.player) hero.player.hoverboardLocked = oldPlayerLock;
            if (oldHas) board.hasHoverboards = oldHas; else delete board.hasHoverboards;
            if (oldSpend) board.spendHoverboard = oldSpend; else delete board.spendHoverboard;
            updateEnergyHud();
        }
    }

    // Called on every coin spawn/awake from patched dependencies.bundle.js
    window.__activeCoins = new Set();

    function isCoinUnderHighBarrier(coin) {
        const physics = (coin && coin.game && coin.game.physics) || (window.game && window.game.physics);
        if (!coin || !coin.body || !physics || !Array.isArray(physics.entities)) return false;
        const cb = coin.body;
        for (const entity of physics.entities) {
            const body = entity && entity.body;
            if (!body || entity === coin || body === cb || body.player || body.deco) continue;
            const name = [entity.name, entity.type, entity.constructor && entity.constructor.name, entity.model && entity.model.name]
                .filter(Boolean).join(' ').toLowerCase();
            const rollBarrier = /blocker[_ -]?roll|roll[_ -]?barrier/.test(name);
            const coinX = cb.x || 0;
            const coinZ = cb.z || 0;
            const halfWidth = ((body.width || 12) + (cb.width || 5)) / 2 + 2;
            const halfDepth = ((body.depth || 8) + (cb.depth || 5)) / 2 + 2;
            if (Math.abs(body.x - coinX) > halfWidth || Math.abs(body.z - coinZ) > halfDepth) continue;
            const coinTop = (cb.bottom !== undefined ? cb.bottom : (cb.y || 0)) + (cb.height || 5);
            const barrierBottom = body.bottom !== undefined ? body.bottom : (body.y || 0);
            const overhead = (body.height || 0) >= 14 && barrierBottom >= coinTop + 2;
            if (rollBarrier || overhead) return true;
        }
        return false;
    }

    function applyCoinCelOutline(targetModel, holder) {
        if (!targetModel || !holder || String(GFX_SETTINGS.coinOutline || '0') !== '1') return;
        try {
            if (!holder._strokeHull && window.__lib && window.__lib.getEntity) {
                const ol = window.__lib.getEntity('currency_coin');
                if (ol) {
                    ol.rx = 0; ol.ry = 0; ol.rz = 0;
                    setEntityHexColor(ol, 0x020202);
                    ol.x = 0; ol.y = 0; ol.z = 0;
                    const setupHullState = obj => {
                        if (!obj) return;
                        const v = obj.view3d;
                        if (v) {
                            const StateCls = (v._state && v._state.constructor) || (v.state && v.state.constructor);
                            if (StateCls) {
                                const st = new StateCls();
                                st.depthTest = true;
                                st.culling = true;
                                st.blend = false;
                                st.clockwiseFrontFace = false;
                                v._state = st;
                                v.state = st;
                            }
                        }
                        const ch = obj.children || (obj.container && obj.container.children);
                        if (ch) for (let i = 0; i < ch.length; i++) setupHullState(ch[i]);
                    };
                    setupHullState(ol);
                    if (ol.scale) ol.scale.set(1.10, 1.10, 1.02);
                    targetModel.addChild(ol);
                    holder._strokeHull = ol;
                }
            }
            if (holder._strokeHull) {
                holder._strokeHull.active = true;
                holder._strokeHull.visible = true;
                setEntityHexColor(holder._strokeHull, 0x020202);
                holder._strokeHull.x = 0; holder._strokeHull.y = 0; holder._strokeHull.z = 0;
                if (holder._strokeHull.scale) holder._strokeHull.scale.set(1.10, 1.10, 1.02);
            }
        } catch(e) {}
    }

    window.__onCoinAwake = function(coin) {
        if (!coin) return;
        if (!window.__activeCoins) window.__activeCoins = new Set();
        window.__activeCoins.add(coin);
        const isNoCoin = !!window.NO_COIN_MODE;
        const attractable = coin.attractable;
        if (attractable) {
            if (!attractable.__normalMagnetUpdate && typeof attractable.update === 'function') {
                attractable.__normalMagnetUpdate = attractable.update;
                attractable.__normalMagnetStart = attractable.attractionStart;
            }
            if (isNoCoin && !coin._isDashItem) {
                attractable.active = false;
                attractable.attracted = false;
                attractable.update = function() {};
                attractable.attractionStart = function() {};
            } else {
                if (attractable.__normalMagnetUpdate) attractable.update = attractable.__normalMagnetUpdate;
                if (attractable.__normalMagnetStart) attractable.attractionStart = attractable.__normalMagnetStart;
                attractable.active = true;
            }
        }
        coin._isDashItem = false;
        coin.visible = true;
        if (coin._strokeHull) {
            coin._strokeHull.active = false;
            coin._strokeHull.visible = false;
            if (coin._strokeHull.scale) coin._strokeHull.scale.set(0, 0, 0);
        }
        if (coin.model) {
            coin.model.active = true;
            coin.model.visible = true;
            if (coin.model.scale) coin.model.scale.set(1, 1, 1);
        }

        const coinZ = coin.body ? coin.body.z : (coin.z || 0);
        const coinX = coin.body ? coin.body.x : (coin.x || 0);
        if (isCoinUnderHighBarrier(coin)) {
            coin.active = false;
            coin.visible = false;
            if (coin.body) { coin.body.width = 0; coin.body.height = 0; coin.body.depth = 0; }
            return;
        }
        coinSpawnCounter++;

        // Spawn collectible Dash Item on the map lanes every ~16 coins when spaced >= 180 Z units
        if (coinSpawnCounter % 16 === 0 && Math.abs(coinZ - lastDashZ) > 180) {
            coin._isDashItem = true;
            lastDashZ = coinZ;
            lastDashLaneX = coinX;
            // Clear any previously spawned overlapping red coins on the same lane
            if (isNoCoin && window.__activeCoins) {
                for (const other of window.__activeCoins) {
                    if (!other || other === coin || other._isDashItem || !other.active) continue;
                    const ox = other.body ? other.body.x : (other.x || 0);
                    const oz = other.body ? other.body.z : (other.z || 0);
                    if (Math.abs(ox - coinX) < 5 && Math.abs(oz - coinZ) < 42) {
                        other.active = false;
                        other.visible = false;
                        if (other.model) { other.model.active = false; other.model.visible = false; }
                        if (other.body) { other.body.width = 0; other.body.height = 0; other.body.depth = 0; }
                    }
                }
            }
            if (coin.attractable) {
                if (coin.attractable.__normalMagnetUpdate) coin.attractable.update = coin.attractable.__normalMagnetUpdate;
                if (coin.attractable.__normalMagnetStart) coin.attractable.attractionStart = coin.attractable.__normalMagnetStart;
                coin.attractable.active = true;
            }
            if (coin.body) {
                coin.body.width = 6.2;
                coin.body.height = 6.2;
                coin.body.depth = 6.2;
            }
            if (coin.model) {
                setEntityHexColor(coin.model, 0x00ff66);
                if (coin.model.scale) coin.model.scale.set(1.5, 1.5, 1.5);
            }
            if (coin.shine) {
                coin.shine.active = true;
                if (coin.shine.view) setEntityHexColor(coin.shine.view, 0x00ff66);
            }
            return;
        }

        // Prevent coins from being bugged inside moving trains or half wagons
        try {
            if (window.game && window.game.physics && Array.isArray(window.game.physics.entities)) {
                for (const ent of window.game.physics.entities) {
                    const b = ent && ent.body;
                    if (!b || b.deco || b.player) continue;
                    const speed = (ent && ent.movable && ent.movable.speed) || (b.velocity && Math.abs(b.velocity.z)) || 0;
                    if (speed && Math.abs(b.x - coinX) < 8.5 && Math.abs(b.z - coinZ) < ((b.depth || 58) / 2 + 10)) {
                        const topY = Number.isFinite(b.top) ? b.top : ((b.bottom || 0) + (b.height || 29));
                        const cBtm = coin.body ? (coin.body.bottom !== undefined ? coin.body.bottom : (coin.body.y || 0)) : 0;
                        if (cBtm < 8) {
                            coin.active = false;
                            coin.visible = false;
                            if (coin.body) { coin.body.width = 0; coin.body.height = 0; coin.body.depth = 0; }
                            return;
                        } else if (cBtm < topY) {
                            if (coin.body) coin.body.bottom = topY + 5.5;
                            if (coin.movable && typeof coin.movable.run === 'function' && ent.movable) {
                                coin.movable.run(ent.movable.speed, ent.movable.target);
                            }
                        }
                    }
                }
            }
        } catch(e) {}

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

        // Prevent coins directly on top of trampolines
        if (customObstacles.some(obs => obs && obs.type === 'trampoline' && Math.abs(obs.x - coinX) < 16 && Math.abs(obs.z - coinZ) < 42)) {
            coin.active = false;
            coin.visible = false;
            if (coin.body) { coin.body.width = 0; coin.body.height = 0; coin.body.depth = 0; }
            return;
        }

        const coinStyle = String(GFX_SETTINGS.coinOutline || '0');
        if (coin.model) {
            if (coinStyle === '2') {
                setEntityHexColor(coin.model, 0x020202);
            } else {
                restoreCoinNativeTexture(coin.model, isNoCoin);
            }
        }
        if (coinStyle === '1' && coin.model) {
            applyCoinCelOutline(coin.model, coin);
        } else if (coin._strokeHull) {
            coin._strokeHull.active = false;
            coin._strokeHull.visible = false;
            if (coin._strokeHull.scale) coin._strokeHull.scale.set(0, 0, 0);
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
        playCoinShatterEffect(coin, 0x16a34a, 1.35, 14, false, true);

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

    function spawnCoinWorldFragments(source, color = 0xffd84a, count = 8, intensity = 1) {
        const hero = window.game && window.game.hero;
        const parent = hero && hero.parent;
        const point = source && source.body ? source.body : source;
        if (!parent || !point || !window.__lib || !window.__lib.getEntity) return;
        const x = Number(point.x), y = Number(point.y), z = Number(point.z);
        if (![x, y, z].every(Number.isFinite)) return;
        const isEnergyBurst = (color === 0x23caff);
        const blueTex = isEnergyBurst ? getEnergyCoinBlueTexture() : null;
        for (let i = 0; i < count; i++) {
            let shard;
            try { shard = window.__lib.getEntity('currency_coin'); } catch(e) { continue; }
            if (!shard) continue;
            shard.rx = Math.PI / 2;
            shard.x = x; shard.y = y; shard.z = z;
            if (shard.scale) shard.scale.set(0.34 * intensity, 0.34 * intensity, 0.08);
            if (isEnergyBurst && blueTex) {
                try {
                    const pending = [shard];
                    while (pending.length) {
                        const node = pending.shift();
                        const mat = node && node.view3d && node.view3d.material;
                        if (mat) {
                            const mats = Array.isArray(mat) ? mat : [mat];
                            mats.forEach(m => {
                                if (!m) return;
                                m.diffuseMap = blueTex;
                                if ('map' in m) m.map = blueTex;
                                m.color = 0x7ae6ff;
                                try { m.emissiveColor = 0x0ea5e9; m.emissive = 0x0ea5e9; } catch(e) {}
                            });
                        }
                        const ch = node && (node.children || (node.container && node.container.children));
                        if (ch) for (let k = 0; k < ch.length; k++) pending.push(ch[k]);
                    }
                } catch(e) {
                    setEntityHexColor(shard, 0x00aaff);
                }
            } else {
                setEntityHexColor(shard, isEnergyBurst ? 0x00aaff : color);
            }
            try { parent.addChild(shard); } catch(e) { continue; }
            const angle = (i / Math.max(count, 1)) * Math.PI * 2 + Math.random() * 0.22;
            const speed = (0.018 + Math.random() * 0.016) * intensity;
            coinShatterFragments.push({
                mesh: shard, x, y, z,
                vx: Math.cos(angle) * speed,
                vy: (0.026 + Math.random() * 0.024) * intensity,
                vz: Math.sin(angle) * speed,
                startedAt: Date.now(), life: 560 + Math.random() * 100,
                scale: 0.34 * intensity
            });
        }
    }

    function playCoinShatterEffect(source = null, color = 0xffd84a, intensity = 1.25, fragmentCount = 10, isBrokenCoin = false, isBoost = false) {
        if (fragmentCount > 0) spawnCoinWorldFragments(source, color, fragmentCount, intensity);
        const burst = document.createElement('div');
        burst.className = 'subway-coin-shatter';
        burst.setAttribute('aria-hidden', 'true');
        const hex = `#${color.toString(16).padStart(6, '0')}`;
        burst.style.setProperty('--coin-burst-color', hex);
        if (isBrokenCoin) {
            burst.innerHTML = '<span class="coin-shatter-flash" style="background: radial-gradient(circle at 50% 59%, rgba(255,46,77,0.5), transparent 42%);"></span>' +
                '<span class="coin-shatter-ring" style="border-color: #ff2844;"></span>' +
                '<div class="coin-broken-wrapper">' +
                '<div class="coin-half coin-half-left"><svg viewBox="0 0 40 80" class="coin-half-svg"><path d="M 40,0 A 40,40 0 0,0 40,80 L 33,62 L 44,45 L 32,24 L 40,0 Z" fill="#ff2844" stroke="#ffffff" stroke-width="3"/><path d="M 28,14 A 25,25 0 0,0 28,66 L 31,52 L 23,38 L 31,22 Z" fill="#990014"/></svg></div>' +
                '<div class="coin-half coin-half-right"><svg viewBox="0 0 40 80" class="coin-half-svg"><path d="M 0,0 L 7,24 L -5,45 L 7,62 L 0,80 A 40,40 0 0,0 0,0 Z" fill="#ff2844" stroke="#ffffff" stroke-width="3"/><path d="M 12,14 L 3,22 L 11,38 L 3,52 L 12,66 A 25,25 0 0,0 12,14 Z" fill="#990014"/></svg></div>' +
                '<div class="coin-crack-spark">💥</div>' +
                '</div>';
        } else if (isBoost) {
            burst.innerHTML = '<span class="coin-shatter-flash" style="background: radial-gradient(circle at 50% 59%, rgba(22,163,74,0.28), transparent 45%);"></span>' +
                '<span class="coin-shatter-ring" style="border-color: #16a34a;"></span>' +
                '<span class="coin-shatter-ring coin-shatter-ring-inner" style="border-color: #15803d;"></span>' +
                '<span class="coin-shatter-core" style="background: radial-gradient(circle at 35% 30%, #4ade80, #15803d 75%); box-shadow: 0 2px 10px rgba(21,128,61,0.45); color: #ffffff;">⚡</span>';
        } else {
            burst.innerHTML = '<span class="coin-shatter-flash"></span><span class="coin-shatter-ring"></span><span class="coin-shatter-ring coin-shatter-ring-inner"></span><span class="coin-shatter-core">✦</span>';
        }
        const shardCount = Math.round(22 * Math.min(1.6, intensity));
        for (let i = 0; i < shardCount; i++) {
            const shard = document.createElement('i');
            shard.className = 'coin-shatter-shard';
            shard.style.setProperty('--angle', `${(i / shardCount) * 360 + (i % 4) * 7}deg`);
            shard.style.setProperty('--distance', `${85 + (i % 5) * 24}px`);
            shard.style.setProperty('--shard-delay', `${(i % 4) * 12}ms`);
            burst.appendChild(shard);
        }
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 900);
    }

    function playEnergyPickupEffect(source) {
        // A compact 3D burst keeps the feedback attached to the world coin
        // instead of flashing over the whole screen.
        const firstFragment = coinShatterFragments.length;
        spawnCoinWorldFragments(source, 0x23caff, 10, 0.82);
        for (let i = firstFragment; i < coinShatterFragments.length; i++) {
            const fragment = coinShatterFragments[i];
            fragment.vx *= 0.72;
            fragment.vz *= 0.72;
            fragment.vy += 0.018;
            fragment.life = 720 + Math.random() * 160;
        }
        const starBurst = document.createElement('div');
        starBurst.className = 'subway-energy-star-burst';
        starBurst.setAttribute('aria-hidden', 'true');
        starBurst.innerHTML = '<span class="energy-pickup-star">✦</span><span class="energy-pickup-star-glint">✦</span>';
        document.body.appendChild(starBurst);
        setTimeout(() => starBurst.remove(), 680);
        showEnergyToast('+1 ENERGIA');
    }

    function updateCoinShatterFragments(now) {
        for (let i = coinShatterFragments.length - 1; i >= 0; i--) {
            const fragment = coinShatterFragments[i];
            const elapsed = now - fragment.startedAt;
            const t = elapsed / fragment.life;
            if (!fragment.mesh || t >= 1) {
                if (fragment.mesh && fragment.mesh.parent) {
                    try { fragment.mesh.parent.removeChild(fragment.mesh); } catch(e) {}
                }
                coinShatterFragments.splice(i, 1);
                continue;
            }
            fragment.mesh.x = fragment.x + fragment.vx * elapsed;
            fragment.mesh.y = fragment.y + fragment.vy * elapsed - 0.000035 * elapsed * elapsed;
            fragment.mesh.z = fragment.z + fragment.vz * elapsed;
            fragment.mesh.ry = (fragment.mesh.ry || 0) + 0.24;
            fragment.mesh.rx = (fragment.mesh.rx || 0) + 0.13;
            const scale = fragment.scale * (1 - t * 0.85);
            if (fragment.mesh.scale) fragment.mesh.scale.set(scale, scale, Math.max(0.025, scale * 0.24));
        }
    }

    // Called when player touches a coin in No Coin Mode
    window.__onNoCoinCollect = function(coin) {
        if (!window.NO_COIN_MODE) return;
        const hero = window.game && window.game.hero;
        const isJetpack = hero && hero.jetpack && ((hero.jetpack.isOn && hero.jetpack.isOn()) || hero.jetpack.active);
        if (isJetpack) return;
        if (Date.now() < dashInvulnUntil) {
            playCoinShatterEffect(coin, 0xff2844, 1.35, 14, true, false);
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
        hideCleanResultsOverlay();
        isRunActive = true;
        deathFrozen = false;
        isGamePaused = false;
        pauseStartedAt = 0;
        runStartTime = performance.now();
        skateEnergy = 0;
        lastEnergyTickTime = runStartTime;
        updateEnergyHud();
        installHoverboardEnergyGate();
        runElapsedTime = 0;
        window.__dashSpeedMult = 1.0;
        lastDashZ = 999999;

        try {
            if (window.game && window.game.hero && window.game.hero.player) {
                // The standard touch button must remain dispatchable in both modes;
                // the energy gate decides whether its tap can activate the board.
                window.game.hero.player.hoverboardLocked = false;
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
                if (now - lastEnergyTickTime >= ENERGY_INTERVAL_MS) {
                    lastEnergyTickTime = now;
                    grantEnergy(1);
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
        updateEnergyHud();
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
        updateEnergyHud();
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
        applyGraphicsSettings();
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
                    const noReviveActive = window.__SW_NO_REVIVE__ || (typeof GFX_SETTINGS !== 'undefined' && GFX_SETTINGS.noRevive);
                    if (noReviveActive) {
                        handleLocalMultiplayerDeath(runElapsedTime);
                        return;
                    }
                    setTimeout(() => {
                        const noRevNow = window.__SW_NO_REVIVE__ || (typeof GFX_SETTINGS !== 'undefined' && GFX_SETTINGS.noRevive);
                        if (MPX.isPracticing && MPX.roundActive && !noRevNow) {
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
    setInterval(() => { installHoverboardEnergyGate(); updateEnergyHud(); }, 250);

    // ==========================================
    // NO COIN DYNAMIC OBSTACLE ENGINE
    // ==========================================
    let customObstacles = [];
    let nextObstacleZ = -300;
    let obstacleChunkCount = 0;
    let trampolineCameraUntil = 0;
    let trampolineLaunchAt = 0;
    let trampolineHitCount = 0;

    function cleanupCustomObstacles() {
        for (let i = 0; i < customObstacles.length; i++) {
            const obs = customObstacles[i];
            removeObstacleViews(obs);
        }
        customObstacles = [];
        obstacleChunkCount = 0;
        trampolineCameraUntil = 0;
        trampolineLaunchAt = 0;
        window.__SW_TRAMPOLINE_AIR_UNTIL__ = 0;
        nextObstacleZ = (window.game && window.game.hero && window.game.hero.body ? window.game.hero.body.z : 0) - 350;
    }

    function removeObstacleViews(obs) {
        if (!obs) return;
        const views = [obs.mesh, ...(obs.parts || [])];
        for (const view of views) {
            if (view && view.parent) {
                try { view.parent.removeChild(view); } catch(e) {}
            }
        }
        if (obs.physicsEntity && window.game && window.game.physics && Array.isArray(window.game.physics.entities)) {
            const idx = window.game.physics.entities.indexOf(obs.physicsEntity);
            if (idx >= 0) window.game.physics.entities.splice(idx, 1);
            obs.physicsEntity = null;
        }
    }

    // Prevents placing obstacle coins/dumpsters inside trains, barriers or native coins
    function isPositionBlocked(x, y, z, margin = 12, ignoredEntity = null) {
        // 1. Existing native map coins
        if (window.__activeCoins) {
            for (const c of window.__activeCoins) {
                if (c && c.active && c.body) {
                    if (Math.abs(c.body.z - z) < 22 && Math.abs(c.body.x - x) < 8 && Math.abs((c.body.y || 0) - y) < 7) {
                        return true;
                    }
                }
            }
        }

        // 2. Trains, ramps and blockers in physics system (prevent spawning inside trains)
        const phys = window.game && window.game.physics;
        if (phys && Array.isArray(phys.entities)) {
            for (let i = 0; i < phys.entities.length; i++) {
                const ent = phys.entities[i];
                if (ent === ignoredEntity) continue;
                const b = ent && ent.body;
                if (b && !b.deco && !b.player) {
                    const halfDepth = (b.depth || 14) / 2 + 15;
                    const halfWidth = (b.width || 14) / 2 + 3;
                    const bodyBottom = Number.isFinite(b.bottom) ? b.bottom : (Number.isFinite(b.y) ? b.y : 0);
                    const bodyTop = Number.isFinite(b.top) ? b.top : bodyBottom + (b.height || 14);
                    const candidateBottom = y - 3;
                    const candidateTop = y + 8;
                    const overlapsVertically = candidateTop > bodyBottom && candidateBottom < bodyTop;
                    if (overlapsVertically && Math.abs(b.x - x) < halfWidth && Math.abs(b.z - z) < halfDepth) {
                        return true;
                    }
                }
            }
        }

        // 3. Already placed custom obstacles
        for (let i = 0; i < customObstacles.length; i++) {
            const obs = customObstacles[i];
            if (obs && !obs.destroyed) {
                if (Math.abs(obs.z - z) < 24 && Math.abs(obs.x - x) < 8 && Math.abs((obs.y || 0) - y) < 7) {
                    return true;
                }
            }
        }
        return false;
    }

    function createObstacle3D(type, x, y, z, options = {}) {
        if (!window.__lib || !window.__lib.getEntity) return null;
        const margin = (type === 'wooden_ramp' || type === 'double_train') ? 70 : ((type === 'dumpster' || type === 'bush' || type === 'blocker_jump' || type === 'blocker_roll') ? 35 : 20);
        try {
            if ((type === 'coin' || type === 'energyCoin') && !options.platformEntity && window.game && window.game.physics && Array.isArray(window.game.physics.entities)) {
                const ents = window.game.physics.entities;
                for (let i = 0; i < ents.length; i++) {
                    const ent = ents[i];
                    const b = ent && ent.body;
                    if (!b || b.deco || b.player) continue;
                    const lbl = `${ent.name || ''} ${ent.type || ''} ${(ent.constructor && ent.constructor.name) || ''} ${(ent.model && ent.model.name) || ''}`.toLowerCase();
                    if (!/train|wagon|freight/.test(lbl)) continue;
                    const hw = (b.width || 18) * 0.5 + 1.5;
                    const hd = (b.depth || 58) * 0.5 + 8;
                    if (Math.abs(b.x - x) <= hw && Math.abs(b.z - z) <= hd) {
                        const topY = Number.isFinite(b.top) ? b.top : ((b.bottom || 0) + (b.height || 29));
                        if (topY > 0 && topY < 22) {
                            const halfRoof = topY + 5.5;
                            y = (y >= 24) ? Math.max(halfRoof, y - Math.max(0, 29 - topY)) : Math.max(y, halfRoof);
                            options = Object.assign({}, options, { platformEntity: ent });
                        } else if (topY >= 22 && y < topY + 4.5) {
                            y = topY + 5.5;
                            options = Object.assign({}, options, { platformEntity: ent });
                        }
                        break;
                    }
                }
            }
        } catch(e) {}
        if (isPositionBlocked(x, y, z, margin, options.platformEntity || null)) return null;

        try {
            let mesh = null;
            let bounds = { depth: 6, width: 14, height: 8 };

            if (type === 'dumpster') {
                mesh = window.__lib.getEntity('dumpster');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI; // Perfectly parallel to rails
                    if (mesh.scale) mesh.scale.set(1.0, 1.0, 1.0);
                    bounds = { depth: 10, width: 16, height: 12 };
                }
            } else if (type === 'bush') {
                mesh = window.__lib.getEntity('bush_1');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI; // Perfectly centered on track
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
            } else if (type === 'blocker_roll') {
                mesh = window.__lib.getEntity('blocker_roll');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(1.0, 1.0, 1.0);
                    bounds = { depth: 6, width: 16, height: 18, rollable: true };
                }
            } else if (type === 'lightSignal') {
                mesh = window.__lib.getEntity('lightSignal');
                if (mesh) {
                    mesh.rx = 0; mesh.rz = 0; mesh.ry = Math.PI;
                    if (mesh.scale) mesh.scale.set(1.0, 1.0, 1.0);
                    bounds = { depth: 8, width: 10, height: 20 };
                }
            } else if (type === 'coin' || type === 'energyCoin') {
                const energyCoin = type === 'energyCoin';
                mesh = energyCoin ? buildEnergyCoinModel() : window.__lib.getEntity('currency_coin');
                if (mesh) {
                    if (!energyCoin && mesh.scale) mesh.scale.set(1.15, 1.15, 1.15);
                    if (!energyCoin) {
                        const coinStyle = String(GFX_SETTINGS.coinOutline || '0');
                        if (coinStyle === '2') {
                            setEntityHexColor(mesh, 0x020202);
                        } else {
                            restoreCoinNativeTexture(mesh, window.NO_COIN_MODE);
                            if (coinStyle === '1') applyCoinCelOutline(mesh, mesh);
                        }
                    }
                    bounds = energyCoin ? { depth: 9, width: 8, height: 11 } : { depth: 5, width: 4, height: 6 };
                }
            }

            if (type === 'trampoline') {
                mesh = buildTrampolineCushionMesh(x, y, z);
                if (mesh) {
                    applyTrampolineGlow(mesh, 1);
                    bounds = { depth: 17.5, width: 17.5, height: 8, isTrampoline: true };
                }
            } else if (type === 'double_train') {
                const getWagon = () => {
                    try {
                        if (window.__lib && window.__lib.hasGeometry && window.__lib.hasGeometry('train_standard')) return window.__lib.getEntity('train_standard');
                    } catch(e) {}
                    try {
                        if (window.__lib && window.__lib.hasGeometry && window.__lib.hasGeometry('train_sub')) return window.__lib.getEntity('train_sub');
                    } catch(e) {}
                    try {
                        return window.__lib.getEntity('train_start');
                    } catch(e) {}
                    return null;
                };
                const bottomWagon = getWagon();
                const topWagon = getWagon();
                if (bottomWagon) {
                    bottomWagon.rx = 0; bottomWagon.rz = 0; bottomWagon.ry = Math.PI;
                    mesh = bottomWagon;
                    if (topWagon) {
                        topWagon.rx = 0; topWagon.rz = 0; topWagon.ry = Math.PI;
                        topWagon._yOffset = 29;
                        topWagon._xOffset = 0;
                        topWagon._zOffset = 0;
                        try { setEntityHexColor(topWagon, 0x4a1e78); } catch(e) {}
                        mesh._doubleTrainParts = [topWagon];
                    }
                    bounds = { depth: 60, width: 18, height: 58, isDoubleTrain: true };
                }
            } else if (type === 'wooden_ramp') {
                let rampMesh = null;
                try {
                    if (window.__lib && window.__lib.hasGeometry && window.__lib.hasGeometry('train_ramp')) {
                        rampMesh = window.__lib.getEntity('train_ramp');
                    }
                } catch(e) {}
                if (rampMesh) {
                    rampMesh.rx = 0; rampMesh.rz = 0; rampMesh.ry = Math.PI;
                    if (rampMesh.scale) rampMesh.scale.set(1.0, 1.0, 1.0);
                    mesh = rampMesh;
                    bounds = { depth: 70, width: 18, height: 29, isWoodenRamp: true };
                }
            }

            if (!mesh) return null;
            mesh.x = x;
            mesh.y = y;
            mesh.z = z;
            const parts = (mesh._energyCoinParts || mesh._trampolineTargetParts || mesh._doubleTrainParts || mesh._woodenRampParts || []).slice();
            for (const part of parts) {
                part.x = x + (part._xOffset || 0);
                part.y = y + (part._yOffset || 0);
                part.z = z + (part._zOffset || part._energyCoinDepthOffset || 0);
            }

            // Reformulated dynamic ground/platform contact shadow for Shaders mode
            let shadowPart = null;
            try {
                const shadTex = ensureReformulatedShadowTexture();
                if (energyCoinGeoCache && energyCoinGeoCache.shadowGeom && shadTex && window.__lib && window.__lib.getEntity) {
                    shadowPart = window.__lib.getEntity('currency_coin');
                    if (shadowPart) {
                        setFirstViewGeometry(shadowPart, energyCoinGeoCache.shadowGeom);
                        const visitSh = obj => {
                            if (!obj) return;
                            const v = obj.view3d;
                            if (v && v.material) {
                                const mats = Array.isArray(v.material) ? v.material : [v.material];
                                mats.forEach(m => {
                                    if (!m) return;
                                    m.diffuseMap = shadTex;
                                    if ('map' in m) m.map = shadTex;
                                    m.color = 0x1e2944;
                                    const alpha = (type === 'coin' || type === 'energyCoin') ? 0.56 : 0.72;
                                    m.alpha = alpha;
                                    if (m.uniforms && m.uniforms.uDiffuseColor) m.uniforms.uDiffuseColor[3] = alpha;
                                });
                                try { v.orderBias = 997; } catch(e) {}
                            }
                            const ch = obj.children || (obj.container && obj.container.children);
                            if (ch) for (let i = 0; i < ch.length; i++) visitSh(ch[i]);
                        };
                        visitSh(shadowPart);
                        const sw = Math.max(0.55, ((bounds && bounds.width) || 6) / 6.2);
                        const sd = Math.max(0.55, ((bounds && bounds.depth) || 6) / 6.2);
                        if (shadowPart.scale) shadowPart.scale.set(sw, 1, sd);
                        shadowPart.rx = 0; shadowPart.ry = 0; shadowPart.rz = 0;
                        shadowPart.x = x + 0.35;
                        const surfY = (options.platformEntity && options.platformEntity.body && Number.isFinite(options.platformEntity.body.top)) ? options.platformEntity.body.top : 0.35;
                        shadowPart.y = Math.max(0.35, (type === 'coin' || type === 'energyCoin') ? surfY + 0.35 : y + 0.3);
                        shadowPart.z = z + 0.65;
                        shadowPart._isContactShadow = true;
                        shadowPart.active = (GFX_SETTINGS.shaders !== 'off');
                        parts.push(shadowPart);
                    }
                }
            } catch(e) {}

            const hero = window.game && window.game.hero;
            if (hero && hero.parent) {
                hero.parent.addChild(mesh);
                for (const part of parts) {
                    try { hero.parent.addChild(part); } catch(e) {}
                }
                const obsObj = {
                    type,
                    x, y, z,
                    mesh,
                    parts,
                    shadowPart,
                    bounds,
                    destroyed: false,
                    isOscillating: !!options.isOscillating,
                    isFloating: !!options.isFloating,
                    baseX: x,
                    baseY: y,
                    speed: options.speed || 1.8,
                    phase: options.phase || 0
                };
                return obsObj;
            }
        } catch(e) {}
        return null;
    }

    function applyTrampolineGlow(mesh, pulse = 1) {
        if (!mesh) return;
        const applyMaterialGlow = obj => {
            if (!obj) return;
            const view = obj && obj.view3d;
            const materialList = view && view.material ? (Array.isArray(view.material) ? view.material : [view.material]) : [];
            for (const material of materialList) {
                if (!material) continue;
                try {
                    material.color = obj.__trampolineTint || 0xffffff;
                    material.emissive = 0x39000a;
                    material.emissiveColor = 0x39000a;
                    material.emissionColor = 0x39000a;
                    material.emission = 0.08 + pulse * 0.12;
                    material.emissiveIntensity = 0.08 + pulse * 0.12;
                } catch(e) {}
            }
            const children = obj && (obj.children || (obj.container && obj.container.children));
            if (children) for (let i = 0; i < children.length; i++) applyMaterialGlow(children[i]);
        };
        applyMaterialGlow(mesh);
    }

    function buildTrampolineCushionMesh(x, y, z) {
        if (!window.__lib || !window.__lib.getEntity) return null;
        let cushion;
        try { cushion = window.__lib.getEntity('currency_coin'); } catch(e) { return null; }
        if (!cushion) return null;
        // The pillow model is authored at roughly two game units across.
        // Scale it to a broad, readable landing pad on top of a wagon.
        const padScale = 5.5;
        const usesPilow = applyPilowGeometry(cushion, pilowGeometry);
        cushion.__trampolineTint = 0xffffff;
        cushion.__trampolineVerticalAxis = usesPilow ? 'y' : 'z';
        if (usesPilow) {
            cushion.rx = 0; cushion.ry = 0; cushion.rz = 0;
            if (cushion.scale) cushion.scale.set(padScale, padScale, padScale);
        } else {
            cushion.rx = Math.PI / 2; cushion.ry = 0; cushion.rz = 0;
            if (cushion.scale) cushion.scale.set(3.0, 3.0, 0.62);
            if (!applyTrampolinePadTexture(cushion)) setEntityHexColor(cushion, 0xe51d36);
        }

        // Both the GLB UVs and the SVG fallback carry the target artwork, so
        // no coin meshes are stacked on top of the pillow.
        cushion._trampolineTargetParts = [];

        // The first trampoline can be spawned before the small GLB fetch
        // finishes. Upgrade that fallback in place so collision stays intact.
        if (!usesPilow) pilowGeometryReady.then(data => {
            if (!data || !applyPilowGeometry(cushion, data)) return;
            cushion.__trampolineTint = 0xffffff;
            cushion.__trampolineVerticalAxis = 'y';
            cushion.rx = 0; cushion.ry = 0; cushion.rz = 0;
            if (cushion.scale) cushion.scale.set(padScale, padScale, padScale);
        });
        return cushion;
    }

    function clearCoinsOnTrampoline(pad) {
        if (!pad) return;
        for (let i = customObstacles.length - 1; i >= 0; i--) {
            const c = customObstacles[i];
            if (!c || (c.type !== 'coin' && c.type !== 'energyCoin')) continue;
            if (Math.abs(c.x - pad.x) < 16 && Math.abs(c.z - pad.z) < 42) {
                removeObstacleViews(c);
                customObstacles.splice(i, 1);
            }
        }
        if (window.__activeCoins) {
            for (const c of window.__activeCoins) {
                if (!c || !c.active || !c.body) continue;
                if (Math.abs(c.body.x - pad.x) < 16 && Math.abs(c.body.z - pad.z) < 42) {
                    c.active = false;
                    c.visible = false;
                    if (c.model) c.model.visible = false;
                    c.body.width = 0; c.body.height = 0; c.body.depth = 0;
                }
            }
        }
    }

    function breakRedCoinsNearTrampoline(pad) {
        if (!window.NO_COIN_MODE || !pad) return 0;
        let broken = 0;
        const nearPad = point => {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
            return Math.abs(point.x - pad.x) < 24 && point.z <= pad.z + 18 && point.z >= pad.z - 145;
        };

        for (let i = customObstacles.length - 1; i >= 0; i--) {
            const coin = customObstacles[i];
            if (!coin || coin.type !== 'coin' || !nearPad(coin)) continue;
            spawnCoinWorldFragments(coin, 0xff394f, 5, 0.75);
            if (coin.mesh && coin.mesh.parent) {
                try { coin.mesh.parent.removeChild(coin.mesh); } catch(e) {}
            }
            customObstacles.splice(i, 1);
            broken++;
        }

        if (window.__activeCoins) {
            for (const coin of window.__activeCoins) {
                if (!coin || !coin.active || coin._isDashItem || !coin.body || !nearPad(coin.body)) continue;
                spawnCoinWorldFragments(coin.body, 0xff394f, 5, 0.75);
                coin.active = false;
                coin.visible = false;
                if (coin.model) coin.model.visible = false;
                coin.body.width = 0;
                coin.body.height = 0;
                coin.body.depth = 0;
                broken++;
            }
        }

        if (broken) {
            playCoinShatterEffect({ x: pad.x, y: pad.y + 5, z: pad.z - 18 }, 0xff394f, 1.5, 0);
        }
        return broken;
    }

    function activateTrampoline(obs, hero, heroBody, heroY, now) {
        if (!obs || obs.used) return false;
        obs.used = true;
        obs.bounceStartedAt = now;
        obs.baseY = obs.mesh ? obs.mesh.y : obs.y;
        obs.baseScale = obs.mesh && obs.mesh.scale ? {
            x: obs.mesh.scale.x,
            y: obs.mesh.scale.y,
            z: obs.mesh.scale.z
        } : { x: 1, y: 1, z: 1 };
        obs.partBaseScales = (obs.parts || []).map(part => part.scale ? {
            x: part.scale.x, y: part.scale.y, z: part.scale.z, yPos: part.y
        } : { x: 1, y: 1, z: 1, yPos: part.y });
        clearCoinsOnTrampoline(obs);
        breakRedCoinsNearTrampoline(obs);
        trampolineHitCount = 0;
        try {
            if (hero.jump && hero.jump.perform) hero.jump.perform(72, true);
            else if (heroBody.velocity) heroBody.velocity.y = 68;
            trampolineLaunchAt = now;
            trampolineCameraUntil = now + 4200;
            window.__SW_TRAMPOLINE_AIR_UNTIL__ = trampolineCameraUntil;
            if (hero.player) {
                const groundNow = Number.isFinite(heroBody.ground) ? heroBody.ground : 0;
                hero.player.cameraTargetY = groundNow;
            }
            const game = window.game;
            if (game && game.sfx && game.sfx.play) game.sfx.play('pickup-super-sneakers');
        } catch(e) {}
        showEnergyToast('MEGA PULÃO!');
        return true;
    }

    function findSafeSpecialPosition(y, startZ) {
        const lanes = [-20, 0, 20];
        const zOffsets = [0, -34, 34, -68, 68, -102, 102];
        const laneStart = obstacleChunkCount % lanes.length;
        for (const zOffset of zOffsets) {
            for (let i = 0; i < lanes.length; i++) {
                const lane = lanes[(i + laneStart) % lanes.length];
                const z = startZ + zOffset;
                if (!isPositionBlocked(lane, y, z, 12)) return { lane, z };
            }
        }
        return null;
    }

    function findTrainTopSpecialPosition(startZ) {
        const physics = window.game && window.game.physics;
        if (!physics || !Array.isArray(physics.entities)) return null;
        const lanes = [-20, 0, 20];
        const trains = physics.entities
            .filter(ent => {
                const body = ent && ent.body;
                const label = `${(ent && ent.name) || ''} ${(ent && ent.type) || ''} ${(ent && ent.constructor && ent.constructor.name) || ''} ${(ent && ent.model && ent.model.name) || ''}`.toLowerCase();
                return !!(body && !body.deco && !body.player && /train|wagon|freight/.test(label));
            })
            .sort((a, b) => Math.abs(a.body.z - startZ) - Math.abs(b.body.z - startZ));

        for (const train of trains) {
            const body = train.body;
            if (Math.abs(body.z - startZ) > 190) continue;
            const trainSpeed = Math.abs((train.movable && train.movable.speed) || (body.velocity && body.velocity.z) || 0);
            if (trainSpeed > 0.05) continue;
            const lane = lanes.reduce((best, current) => Math.abs(current - body.x) < Math.abs(best - body.x) ? current : best, lanes[0]);
            if (Math.abs(lane - body.x) > Math.max(8, (body.width || 18) / 2)) continue;
            const depth = body.depth || 60;
            const z = Math.max(body.z - depth / 2 + 16, Math.min(startZ, body.z + depth / 2 - 16));
            const bottom = Number.isFinite(body.bottom) ? body.bottom : (body.y || 0);
            const top = Number.isFinite(body.top) ? body.top : bottom + (body.height || 18);
            if (!isPositionBlocked(lane, top, z, 12, train)) {
                return { lane, x: lane, y: top, z, platformEntity: train, platformDepth: depth, platformWidth: body.width || 18, platformCenterZ: body.z };
            }
        }
        return null;
    }

    function spawnTrainTopCoinPattern(startZ) {
        const spot = findTrainTopSpecialPosition(startZ);
        if (!spot) return false;
        const usableDepth = Math.max(0, spot.platformDepth - 32);
        const count = Math.max(2, Math.min(7, Math.floor(usableDepth / 22) + 1));
        const spacing = 22;
        const span = (count - 1) * spacing;
        const firstZ = Math.max(
            spot.platformCenterZ - spot.platformDepth / 2 + 16,
            Math.min(startZ - span / 2, spot.platformCenterZ + spot.platformDepth / 2 - 16 - span)
        );
        const pattern = Math.floor(Math.random() * 5);
        const heights = [0, 2.5, 4.5, 2.5, 0];
        const coinBaseY = spot.y + 6.5;
        let spawned = 0;

        for (let i = 0; i < count; i++) {
            const x = spot.lane;
            let y = coinBaseY;
            if (pattern === 1) y += (i / Math.max(1, count - 1)) * 4;
            if (pattern === 2) y += heights[Math.round(i * 4 / Math.max(1, count - 1))];
            if (pattern === 3) {
                const t = i / Math.max(1, count - 1);
                y += 1.5 + Math.sin(t * Math.PI) * 4;
            }
            if (pattern === 4) {
                const t = i / Math.max(1, count - 1);
                y += Math.sin(t * Math.PI * 2) * 2.2 + 2.2;
            }

            const z = firstZ + i * spacing;
            const nextToSpring = customObstacles.some(obs => obs && obs.type === 'trampoline' &&
                Math.abs(obs.x - x) < 12 && Math.abs(obs.z - z) < 150);
            if (nextToSpring) continue;
            const coin = createObstacle3D('coin', x, y, z, { platformEntity: spot.platformEntity });
            if (coin) {
                customObstacles.push(coin);
                spawned++;
            }
        }
        return spawned > 0;
    }

    function spawnSupplementalCoinTrail(centerZ) {
        const lanes = [-20, 0, 20];
        const spacing = 22;
        const firstZ = centerZ - 220;
        const choices = lanes.map(lane => {
            let clear = 0;
            for (let i = 0; i < 4; i++) {
                const z = firstZ - i * spacing;
                const nearPad = customObstacles.some(obs => obs && obs.type === 'trampoline' &&
                    Math.abs(obs.x - lane) < 10 && Math.abs(obs.z - z) < 150);
                const duplicate = customObstacles.some(obs => obs && obs.type === 'coin' &&
                    Math.abs(obs.x - lane) < 8 && Math.abs(obs.z - z) < 20);
                if (!nearPad && !duplicate && !isPositionBlocked(lane, 7, z, 9)) clear++;
            }
            return { lane, clear };
        }).sort((a, b) => b.clear - a.clear);

        const choice = choices[0];
        if (!choice || choice.clear < 3) return 0;
        const physics = window.game && window.game.physics;
        const nearTrain = !!(physics && Array.isArray(physics.entities) && physics.entities.some(ent => {
            const b = ent && ent.body;
            const lbl = `${(ent && ent.name) || ''} ${(ent && ent.type) || ''} ${(ent && ent.model && ent.model.name) || ''}`.toLowerCase();
            return b && !b.deco && !b.player && /train|wagon|freight/.test(lbl) && Math.abs(b.z - firstZ) < 150;
        }));
        const makeWave = !nearTrain && obstacleChunkCount % 3 === 0;
        let spawned = 0;
        for (let i = 0; i < 4; i++) {
            const z = firstZ - i * spacing;
            if (isPositionBlocked(choice.lane, 7, z, 9)) continue;
            if (customObstacles.some(obs => obs && obs.type === 'trampoline' &&
                Math.abs(obs.x - choice.lane) < 10 && Math.abs(obs.z - z) < 150)) continue;
            if (customObstacles.some(obs => obs && obs.type === 'coin' &&
                Math.abs(obs.x - choice.lane) < 8 && Math.abs(obs.z - z) < 20)) continue;
            const coin = createObstacle3D('coin', choice.lane, 7, z, makeWave ? {
                isOscillating: true,
                speed: 1.35,
                phase: i * 0.62
            } : {});
            if (coin) {
                customObstacles.push(coin);
                spawned++;
            }
        }
        return spawned;
    }

    function spawnNoCoinObstaclePattern(centerZ) {
        const lanes = [-20, 0, 20];
        obstacleChunkCount++;
        const freeGroundLanes = lanes.filter(lx => !isPositionBlocked(lx, 0, centerZ, 12));

        // Put blue energy coins and the spring into a predictable rotation so
        // players can actually encounter both during an ordinary run.
        if (obstacleChunkCount % 12 === 1) {
            const safeSpot = findSafeSpecialPosition(7, centerZ);
            const count = 1 + Math.floor(Math.random() * 3);
            if (safeSpot) {
                for (let i = 0; i < count; i++) {
                    const coin = createObstacle3D('energyCoin', safeSpot.lane, 7, safeSpot.z - i * 28);
                    if (coin) customObstacles.push(coin);
                }
            }
            if (safeSpot && customObstacles.some(obs => obs && obs.type === 'energyCoin' && Math.abs(obs.z - safeSpot.z) < 90)) return;
        } else if (obstacleChunkCount % 8 === 3) {
            const trainTop = Math.random() < 0.45 ? findTrainTopSpecialPosition(centerZ) : null;
            const safeSpot = trainTop || findSafeSpecialPosition(0, centerZ);
            const options = safeSpot && safeSpot.platformEntity ? { platformEntity: safeSpot.platformEntity } : {};
            const pad = safeSpot && createObstacle3D('trampoline', safeSpot.lane, safeSpot.y || 0, safeSpot.z, options);
            if (pad) customObstacles.push(pad);
            if (pad) return;
        }

        // Fill long gaps with a short, safe route while preserving the existing
        // random obstacle and coin-pattern rotation.
        spawnSupplementalCoinTrail(centerZ);

        // More frequent wagon-top routes, using the train's actual roof height.
        if (obstacleChunkCount % 3 !== 1 && spawnTrainTopCoinPattern(centerZ)) return;

        // Put a visible coin formation in the regular route every fourth chunk.
        // The previous broad train check treated objects above or below the coin
        // as blockers, which could silently reject every coin in a curved section.
        if (obstacleChunkCount % 4 === 0) {
            const safeSpot = findSafeSpecialPosition(7, centerZ);
            const nearTrampoline = safeSpot && customObstacles.some(obs => obs && obs.type === 'trampoline' &&
                Math.abs(obs.x - safeSpot.lane) < 8 && Math.abs(obs.z - safeSpot.z) < 170);
            if (safeSpot && !nearTrampoline) {
                let spawned = 0;
                for (let i = 0; i < 5; i++) {
                    const coin = createObstacle3D('coin', safeSpot.lane, 7, safeSpot.z - i * 26);
                    if (coin) {
                        customObstacles.push(coin);
                        spawned++;
                    }
                }
                if (spawned) return;
            }
        }

        // Add a separate red-coin route in No Coin mode. This runs independently
        // of trampoline spawning, so its coins never form a trail in front of a pad.
        if (window.NO_COIN_MODE && obstacleChunkCount % 3 === 2) {
            const safeSpot = findSafeSpecialPosition(7, centerZ);
            const nearTrampoline = safeSpot && customObstacles.some(obs => obs && obs.type === 'trampoline' &&
                Math.abs(obs.x - safeSpot.lane) < 8 && Math.abs(obs.z - safeSpot.z) < 170);
            if (safeSpot && !nearTrampoline) {
                const previousCount = customObstacles.length;
                for (let i = 0; i < 4; i++) {
                    const coin = createObstacle3D('coin', safeSpot.lane, 7, safeSpot.z - i * 26);
                    if (coin) customObstacles.push(coin);
                }
                if (customObstacles.length > previousCount) return;
            }
        }
        if (freeGroundLanes.length === 0) return;

        // Pattern selector: readable coin formations across tracks and rooftops.
        // 0: Moeda Móvel Oscilante (desliza de um lado pro outro continuamente)
        // 1: Muro de Moedas (2 pistas bloqueadas com moedas no chão e no ar, 1 brecha)
        // 2: Moedas Voando no Alto (teto flutuante y=18, proíbe pulo, exige rolamento)
        // 3: Pulo Obrigatório de Moedas (barreira de chão y=5 nas pistas)
        // 4: Slalom / Zig-Zag de Moedas (4 moedas em ziguezague ao longo da pista)
        // 5: Torre Vertical de Moedas (3 moedas empilhadas y=5, y=12, y=19) + Mato/Caçamba
        // 6: Moeda Voadora com Ondulação Vertical (sobe e desce em onda y=8 a y=20)
        // 7: Dupla Moeda Móvel Cruzada (duas moedas deslizando em direções opostas)
        // 8: Mato 3D (bush_1) + Moeda Flutuante no alto
        // 9–12: coin arches, stair trails and lane sweeps
        // 13: trampoline; the only new solid obstacle
        // 14: familiar native obstacle
        // 15–17: new coin formations (diamond, fork merge and triple wave)
        const pattern = Math.random() < 0.20
            ? [0, 6, 7][Math.floor(Math.random() * 3)]
            : Math.floor(Math.random() * 18);

        if (pattern === 0) {
            // 1. MOEDA MÓVEL OSCILANTE: Desliza de -20 a +20 através das 3 pistas
            const c = createObstacle3D('coin', 0, 6, centerZ, {
                isOscillating: true,
                speed: 2.2 + Math.random() * 0.8,
                phase: Math.random() * Math.PI
            });
            if (c) customObstacles.push(c);

            // Adiciona um mato ou caçamba na lateral para forçar o desvio
            const sideLane = Math.random() > 0.5 ? -20 : 20;
            if (!isPositionBlocked(sideLane, 0, centerZ - 50, 15)) {
                const b = createObstacle3D(Math.random() > 0.4 ? 'bush' : 'dumpster', sideLane, 0, centerZ - 50);
                if (b) customObstacles.push(b);
            }
        } else if (pattern === 1) {
            // 2. MURO DE MOEDAS: Fecha 2 pistas com moedas no chão e no ar, deixando 1 brecha
            if (freeGroundLanes.length >= 2) {
                const openLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
                freeGroundLanes.forEach(lx => {
                    if (lx !== openLane) {
                        // Moeda no chão
                        const c1 = createObstacle3D('coin', lx, 6, centerZ);
                        if (c1) customObstacles.push(c1);
                        // Moeda no ar (muro duplo)
                        const c2 = createObstacle3D('coin', lx, 14, centerZ);
                        if (c2) customObstacles.push(c2);
                    }
                });
            }
        } else if (pattern === 2) {
            // 3. MOEDAS VOANDO NO ALTO: Teto flutuante a y=18 (força a correr por baixo ou rolar)
            lanes.forEach(lx => {
                if (!isPositionBlocked(lx, 18, centerZ, 12)) {
                    const c = createObstacle3D('coin', lx, 18, centerZ);
                    if (c) customObstacles.push(c);
                }
            });
        } else if (pattern === 3) {
            // 4. PULO OBRIGATÓRIO DE MOEDAS: Barreira rente ao chão (y=4.5) que exige pular
            freeGroundLanes.forEach(lx => {
                const c = createObstacle3D('coin', lx, 4.5, centerZ);
                if (c) customObstacles.push(c);
            });
        } else if (pattern === 4) {
            // 5. SLALOM / ZIG-ZAG DE MOEDAS: Linha sinuosa de moedas alternadas
            const order = [-20, 0, 20, 0, -20, 0];
            if (Math.random() > 0.5) order.reverse();
            order.forEach((lx, idx) => {
                const pz = centerZ - (idx * 40);
                if (!isPositionBlocked(lx, 6, pz, 15)) {
                    const c = createObstacle3D('coin', lx, 6, pz);
                    if (c) customObstacles.push(c);
                }
            });
        } else if (pattern === 5) {
            // 6. TORRE VERTICAL DE MOEDAS: Coluna de 3 moedas empilhadas em uma pista
            const tLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            [5, 12, 19].forEach(yPos => {
                const c = createObstacle3D('coin', tLane, yPos, centerZ);
                if (c) customObstacles.push(c);
            });
            // Mato ou barreira na pista vizinha
            const other = freeGroundLanes.filter(l => l !== tLane);
            if (other.length > 0) {
                const obs = createObstacle3D('bush', other[0], 0, centerZ - 40);
                if (obs) customObstacles.push(obs);
            }
        } else if (pattern === 6) {
            // 7. MOEDA VOADORA COM ONDULAÇÃO: Flutua subindo e descendo no ar
            const lane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const c = createObstacle3D('coin', lane, 12, centerZ, {
                isFloating: true,
                speed: 2.0,
                phase: Math.random() * Math.PI
            });
            if (c) customObstacles.push(c);
        } else if (pattern === 7) {
            // 8. DUPLA MOEDA MÓVEL CRUZADA: Duas moedas cruzando a pista simultaneamente
            const c1 = createObstacle3D('coin', -15, 6, centerZ, {
                isOscillating: true,
                speed: 2.4,
                phase: 0
            });
            const c2 = createObstacle3D('coin', 15, 6, centerZ - 60, {
                isOscillating: true,
                speed: 2.4,
                phase: Math.PI
            });
            if (c1) customObstacles.push(c1);
            if (c2) customObstacles.push(c2);
        } else if (pattern === 8) {
            // 9. MATO 3D (bush_1) + ARCO DE MOEDAS NO ALTO
            const bLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const b = createObstacle3D('bush', bLane, 0, centerZ);
            if (b) customObstacles.push(b);

            const otherFree = freeGroundLanes.filter(l => l !== bLane);
            if (otherFree.length > 0) {
                const c = createObstacle3D('coin', otherFree[0], 15, centerZ);
                if (c) customObstacles.push(c);
            }
        } else if (pattern === 9) {
            // Staircase of coins that climbs and drops across the lanes.
            const order = [-20, 0, 20, 0, -20, 0, 20];
            const heights = [5, 9, 14, 18, 14, 9, 5];
            if (Math.random() > 0.5) order.reverse();
            order.forEach((lane, i) => {
                const coin = createObstacle3D('coin', lane, heights[i], centerZ - i * 30);
                if (coin) customObstacles.push(coin);
            });
        } else if (pattern === 10) {
            // Low coin sweep alternating across all three lanes.
            const order = [-20, 0, 20, 0, -20, 0, 20, 0, -20];
            if (Math.random() > 0.5) order.reverse();
            order.forEach((lane, i) => {
                const coin = createObstacle3D('coin', lane, 6, centerZ - i * 24);
                if (coin) customObstacles.push(coin);
            });
        } else if (pattern === 11) {
            // Two parallel rows with a safe lane between them.
            const openLane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            lanes.filter(lane => lane !== openLane).forEach(lane => {
                for (let i = 0; i < 5; i++) {
                    const coin = createObstacle3D('coin', lane, i % 2 ? 11 : 5, centerZ - i * 26);
                    if (coin) customObstacles.push(coin);
                }
            });
        } else if (pattern === 12) {
            // A high arc that rewards a jump while leaving the neighboring lanes clear.
            const lane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            [6, 10, 15, 18, 15, 10, 6].forEach((height, i) => {
                const coin = createObstacle3D('coin', lane, height, centerZ - i * 24);
                if (coin) customObstacles.push(coin);
            });
        } else if (pattern === 13) {
            // Trampoline is spawned by the predictable special-item rotation above.
            const lane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const obs = createObstacle3D('bush', lane, 0, centerZ);
            if (obs) customObstacles.push(obs);
        } else if (pattern === 15) {
            // Diamond trail: widen from a center lane and fold back to the tip.
            const lane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const sideLanes = lanes.filter(value => value !== lane);
            const order = [lane, sideLanes[0], lane, sideLanes[1], lane];
            order.forEach((coinLane, i) => {
                const z = centerZ - i * 27;
                if (!isPositionBlocked(coinLane, 6, z, 10)) {
                    const coin = createObstacle3D('coin', coinLane, i === 1 || i === 3 ? 10 : 6, z);
                    if (coin) customObstacles.push(coin);
                }
            });
        } else if (pattern === 16) {
            // Two branches converge into a fast center-lane run.
            const sideOrder = Math.random() < 0.5 ? [-20, 20] : [20, -20];
            const order = [sideOrder[0], sideOrder[1], 0, 0, 0, sideOrder[1], sideOrder[0]];
            order.forEach((coinLane, i) => {
                const z = centerZ - i * 25;
                const y = i === 1 || i === 5 ? 9 : 6;
                if (!isPositionBlocked(coinLane, y, z, 10)) {
                    const coin = createObstacle3D('coin', coinLane, y, z);
                    if (coin) customObstacles.push(coin);
                }
            });
        } else if (pattern === 17) {
            // Three-lane wave: staggered heights make the route readable in motion.
            const order = [-20, 0, 20, 0, -20, 0, 20, 0, -20];
            const heights = [6, 9, 13, 16, 13, 9, 6, 9, 13];
            if (Math.random() < 0.5) order.reverse();
            order.forEach((coinLane, i) => {
                const z = centerZ - i * 24;
                if (!isPositionBlocked(coinLane, heights[i], z, 10)) {
                    const coin = createObstacle3D('coin', coinLane, heights[i], z);
                    if (coin) customObstacles.push(coin);
                }
            });
        } else {
            // 10. OBSTÁCULOS NATIVOS: Caçamba, Cavalete de Pulo ou Rolo (Semáforo muito raro: < 5%)
            const lane = freeGroundLanes[Math.floor(Math.random() * freeGroundLanes.length)];
            const r = Math.random();
            let obsType = 'bush';
            if (r < 0.35) obsType = 'bush';
            else if (r < 0.65) obsType = 'blocker_jump';
            else if (r < 0.88) obsType = 'dumpster';
            else if (r < 0.96) obsType = 'blocker_roll';
            else obsType = 'lightSignal'; // Apenas 4% de chance para semáforo

            const obs = createObstacle3D(obsType, lane, 0, centerZ);
            if (obs) customObstacles.push(obs);
        }
    }

    let lastObstacleTickMs = 0;
    let prevObstacleHeroZ = null;

    function updateNoCoinObstacleEngine() {
        const frameNow = Date.now();
        const dtFactor = lastObstacleTickMs ? Math.min(3, Math.max(0.02, (frameNow - lastObstacleTickMs) / 16.6667)) : 1;
        lastObstacleTickMs = frameNow;
        updateCoinShatterFragments(frameNow);
        if (!window.game || !window.game.hero || !window.game.hero.body) {
            prevObstacleHeroZ = null;
            if (customObstacles.length) cleanupCustomObstacles();
            return;
        }

        const hero = window.game.hero;
        const heroBody = hero.body;
        let heroZ = heroBody.z;
        const prevHeroZ = (prevObstacleHeroZ !== null && Math.abs(prevObstacleHeroZ - heroZ) < 120) ? prevObstacleHeroZ : heroZ;
        prevObstacleHeroZ = heroZ;
        const heroX = heroBody.x;
        const heroY = heroBody.y !== undefined ? heroBody.y : (heroBody.bottom || 0);

        if (window.isGamePaused) return;

        if (Date.now() < trampolineCameraUntil && hero.player) {
            const feetY = Number.isFinite(heroBody.bottom) ? heroBody.bottom : heroY;
            const groundY = Number.isFinite(heroBody.ground) ? heroBody.ground : 0;
            const elapsedAir = Date.now() - trampolineLaunchAt;
            if (elapsedAir > 180 && (heroBody.landed || feetY <= groundY + 0.55)) {
                trampolineCameraUntil = 0;
                trampolineLaunchAt = 0;
                trampolineHitCount = 0;
                window.__SW_TRAMPOLINE_AIR_UNTIL__ = 0;
                hero.player.cameraTargetY = groundY;
                hero.player.cameraY = groundY;
            } else {
                hero.player.cameraTargetY = groundY + Math.max(0, feetY - groundY) * 0.55;
            }
        }

        // Check spawn ahead of runner at native train horizon distance
        if (heroZ < nextObstacleZ) {
            spawnNoCoinObstaclePattern(heroZ - 480);
            nextObstacleZ = heroZ - (130 + Math.random() * 70);
        }

        // Update active obstacles
        const now = frameNow;
        const isDashing = now < dashInvulnUntil;

        // Resolve spring contact before coin collisions so nearby No Coin
        // pickups shatter instead of ending the run on the same frame.
        for (const pad of customObstacles) {
            if (!pad || pad.type !== 'trampoline') continue;
            clearCoinsOnTrampoline(pad);
            if (pad.used) continue;
            const dz = Math.abs(pad.z - heroZ);
            const dx = Math.abs(pad.x - heroX);
            const dy = Math.abs(pad.y - heroY);
            if (dz < (pad.bounds.depth / 2) + 3 && dx < (pad.bounds.width / 2) + 1.5 && dy < pad.bounds.height + 2) {
                activateTrampoline(pad, hero, heroBody, heroY, now);
                heroZ = heroBody.z;
                break;
            }
        }

        for (let i = customObstacles.length - 1; i >= 0; i--) {
            const obs = customObstacles[i];
            if (!obs || obs.destroyed) {
                customObstacles.splice(i, 1);
                continue;
            }

            if (obs.type === 'trampoline' && obs.bounceStartedAt) {
                const elapsed = now - obs.bounceStartedAt;
                if (elapsed >= 620) {
                    removeObstacleViews(obs);
                    customObstacles.splice(i, 1);
                    continue;
                }
                const base = obs.baseScale || { x: 1, y: 1, z: 1 };
                let squash;
                if (elapsed < 120) {
                    const t = elapsed / 120;
                    squash = t * t * (3 - 2 * t);
                } else if (elapsed < 245) {
                    const t = (elapsed - 120) / 125;
                    squash = 1 - 1.34 * (t * t * (3 - 2 * t));
                } else {
                    const t = Math.min(1, (elapsed - 245) / 375);
                    squash = -0.34 * (1 - t) * Math.sin(t * Math.PI * 2.15);
                }
                if (obs.mesh && obs.mesh.scale) {
                    const bulge = 1 + Math.max(0, -squash) * 0.13;
                    if (obs.mesh.__trampolineVerticalAxis === 'y') {
                        obs.mesh.scale.set(base.x * bulge, base.y * (1 - squash * 0.68), base.z * bulge);
                    } else {
                        obs.mesh.scale.set(base.x * bulge, base.y * bulge, base.z * (1 - squash * 0.68));
                    }
                    obs.mesh.y = obs.baseY - squash * 0.58;
                    applyTrampolineGlow(obs.mesh, 0.65 + Math.max(0, squash) * 0.35);
                }
                const partBases = obs.partBaseScales || [];
                (obs.parts || []).forEach((part, index) => {
                    if (!part || !part.scale) return;
                    const partBase = partBases[index] || { x: part.scale.x, y: part.scale.y, z: part.scale.z, yPos: part.y };
                    const bulge = 1 + Math.max(0, -squash) * 0.13;
                    part.scale.set(partBase.x * bulge, partBase.y * bulge, partBase.z * (1 - squash * 0.68));
                    part.y = partBase.yPos - squash * 0.58;
                });
                continue;
            }

            // Passed behind player: remove immediately
            if (obs.z > heroZ + 50) {
                removeObstacleViews(obs);
                customObstacles.splice(i, 1);
                continue;
            }

            // High-performance distance culling: skip heavy math for far obstacles
            const cullDz = Math.abs(obs.z - heroZ);
            if (cullDz > 180) continue;

            // Oscillating dynamic horizontal movement across lanes
            if (obs.isOscillating && obs.mesh) {
                obs.x = Math.sin(now * 0.003 * obs.speed + obs.phase) * 20;
                obs.mesh.x = obs.x;
                if (obs.shadowPart) obs.shadowPart.x = obs.x + 0.35;
            }

            // Vertical floating wave movement in air
            if (obs.isFloating && obs.mesh) {
                obs.y = (obs.baseY || 12) + Math.sin(now * 0.004 * obs.speed + obs.phase) * 7;
                obs.mesh.y = obs.y;
            }
            if (obs.type === 'trampoline' && obs.mesh) {
                applyTrampolineGlow(obs.mesh, 0.55 + Math.sin(now * 0.008) * 0.45);
            }

            // Apply the native magnet pull to custom coin routes in normal mode.
            const magnet = hero.magnet;
            const magnetMayCollect = (obs.type === 'coin' && !window.NO_COIN_MODE) || obs.type === 'energyCoin';
            if (magnetMayCollect && magnet && magnet.isOn && magnet.isOn() && cullDz < 110) {
                const targetY = heroBody.center && Number.isFinite(heroBody.center.y) ? heroBody.center.y : heroY + 2;
                const targetZ = heroZ + ((heroBody.velocity && heroBody.velocity.z) || -8) * 0.7;
                const mdx = heroX - obs.x;
                const mdy = targetY - obs.y;
                const mdz = targetZ - obs.z;
                const distance = Math.sqrt(mdx * mdx + mdy * mdy + mdz * mdz);
                if (distance < 110) {
                    const basePull = 0.11 + (1 - distance / 110) * 0.1;
                    const pull = 1 - Math.pow(Math.max(0.01, 1 - basePull), dtFactor);
                    obs.x += mdx * pull;
                    obs.y += mdy * pull;
                    obs.z += mdz * pull;
                    if (obs.mesh) { obs.mesh.x = obs.x; obs.mesh.y = obs.y; obs.mesh.z = obs.z; }
                }
            }

            // Spin coin
            if ((obs.type === 'coin' || obs.type === 'energyCoin') && obs.mesh && obs.mesh.rotation) {
                obs.mesh.rotation.y += (obs.type === 'energyCoin' ? 0.065 : 0.09) * dtFactor;
                if (obs.type === 'energyCoin') {
                    for (const part of (obs.parts || [])) {
                        if (part._energyCoinRing) {
                            if (part.rotation) {
                                part.rotation.y -= 0.11 * dtFactor;
                                part.rotation.x = 0.42 + Math.sin(now * 0.004) * 0.18;
                            } else {
                                part.ry = (part.ry || 0) - 0.11 * dtFactor;
                            }
                        } else {
                            const rotationY = obs.mesh.rotation.y + (part._energyCoinRotationOffset || 0);
                            if (part.rotation) part.rotation.y = rotationY;
                            else part.ry = rotationY;
                        }
                    }
                }
            }
            const zMin = Math.min(prevHeroZ, heroZ);
            const zMax = Math.max(prevHeroZ, heroZ);
            const dz = obs.z < zMin ? (zMin - obs.z) : (obs.z > zMax ? (obs.z - zMax) : 0);
            const dx = Math.abs(obs.x - heroX);
            const dy = Math.abs(obs.y - heroY);

            // Calibrated hitboxes per obstacle type
            const isEnergy = obs.type === 'energyCoin';
            const hitDepth = (obs.bounds ? obs.bounds.depth / 2 : 5) + (isEnergy ? 4.5 : 3.0);
            const hitWidth = (obs.bounds ? obs.bounds.width / 2 : 4) + (isEnergy ? 3.5 : 1.5);
            const hitHeight = (obs.bounds ? obs.bounds.height : 6) + (isEnergy ? 4.0 : 2.0);

            if (dz < hitDepth && dx < hitWidth && dy < hitHeight) {
                if (isDashing) {
                    if (obs.type === 'energyCoin') {
                        grantEnergy(1);
                        playEnergyPickupEffect(obs);
                    }
                    else if (obs.type === 'coin' && !window.NO_COIN_MODE) collectGeneratedCoin(hero);
                    if (obs.type === 'coin') {
                        const shardColor = window.NO_COIN_MODE ? 0xff394f : 0xffd84a;
                        playCoinShatterEffect(obs, shardColor, 1.15);
                    }
                    obs.destroyed = true;
                    removeObstacleViews(obs);
                    customObstacles.splice(i, 1);

                    continue;
                } else {
                    if (obs.type === 'energyCoin') {
                        grantEnergy(1);
                        playEnergyPickupEffect(obs);
                        try { if (window.game && window.game.sfx) window.game.sfx.play('pickup-coin', { volume: 0.8 }); } catch(e) {}
                        obs.destroyed = true;
                        removeObstacleViews(obs);
                        customObstacles.splice(i, 1);
                        continue;
                    }
                    if (obs.type === 'coin') {
                        obs.destroyed = true;
                        removeObstacleViews(obs);
                        customObstacles.splice(i, 1);
                        if (window.NO_COIN_MODE) {
                            triggerNoCoinDeath(null);
                            return;
                        }
                        collectGeneratedCoin(hero);
                        continue;
                    }

                    // Check if player cleared obstacle cleanly:
                    const isJumping = heroY >= 7.5;
                    const isRolling = hero && hero.character && (
                        (hero.character.roll && hero.character.roll.active) ||
                        (hero.anim && hero.anim.currentAnimationClipName === 'roll')
                    );

                    if (obs.type === 'trampoline') {
                        if (!obs.used) activateTrampoline(obs, hero, heroBody, heroY, now);
                        continue;
                    }
                    if (obs.type === 'wooden_ramp') {
                        const progress = Math.max(0, Math.min(1, ((obs.z + 35) - heroZ) / 70));
                        const rampY = progress * 29;
                        if (heroY >= rampY - 12) {
                            heroBody.ground = Math.max(heroBody.ground || 0, rampY);
                            heroBody.bottom = Math.max(heroBody.bottom || 0, rampY);
                            heroBody.landed = true;
                        }
                        continue;
                    }
                    if (obs.type === 'double_train') {
                        if (heroY >= 48) {
                            heroBody.ground = Math.max(heroBody.ground || 0, 58);
                            heroBody.bottom = Math.max(heroBody.bottom || 0, 58);
                            heroBody.landed = true;
                        } else if (heroY >= 20) {
                            heroBody.ground = Math.max(heroBody.ground || 0, 29);
                            heroBody.bottom = Math.max(heroBody.bottom || 0, 29);
                            heroBody.landed = true;
                        }
                        continue;
                    }

                    if (obs.type === 'blocker_jump' && isJumping) {
                        continue; // Cleared jump barrier
                    }
                    if (obs.type === 'blocker_roll' && isRolling) {
                        continue; // Cleared roll barrier
                    }
                    if (obs.type === 'bush' && isJumping) {
                        continue; // Cleared bush jump
                    }

                    if (now < trampolineCameraUntil) {
                        trampolineHitCount++;
                        if (trampolineHitCount <= 1) {
                            obs.destroyed = true;
                            playCoinShatterEffect(obs, 0xffd84a, 1.2);
                            removeObstacleViews(obs);
                            customObstacles.splice(i, 1);
                            try {
                                if (hero && hero.player && typeof hero.player.dizzyStart === 'function') hero.player.dizzyStart();
                                else if (hero && hero.player && typeof hero.player.stumble === 'function') hero.player.stumble();
                                if (hero.jump && hero.jump.perform) hero.jump.perform(58, true);
                                else if (heroBody.velocity) heroBody.velocity.y = 56;
                                trampolineLaunchAt = now;
                                trampolineCameraUntil = now + 2400;
                                window.__SW_TRAMPOLINE_AIR_UNTIL__ = trampolineCameraUntil;
                            } catch(e) {}
                            continue;
                        } else {
                            trampolineCameraUntil = 0;
                            if (window.NO_COIN_MODE) {
                                triggerNoCoinDeath(null);
                                return;
                            } else if (hero && hero.player && typeof hero.player.die === 'function') {
                                hero.player.die('train');
                                return;
                            }
                        }
                    }

                    obs.destroyed = true;
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

            // Passed behind player
            if (obs.z > heroZ + 80) {
                removeObstacleViews(obs);
                customObstacles.splice(i, 1);
            }
        }
    }

    function collectGeneratedCoin(hero) {
        const game = window.game;
        if (!game) return;
        if (game.stats) game.stats.coins = (game.stats.coins || 0) + 1;
        try { if (game.missions) game.missions.addStat(1, 'mission-pickup-coins'); } catch(e) {}
        try { if (game.sfx) game.sfx.play('pickup-coin', { volume: 0.5 }); } catch(e) {}
        try {
            if (hero && hero.pop && typeof hero.pop.play === 'function') hero.pop.play();
            else if (hero && hero.popPickup && typeof hero.popPickup.play === 'function') hero.popPickup.play();
        } catch(e) {}
    }

    function hideCleanResultsOverlay() {
        const overlay = document.getElementById('subway-clean-results');
        if (overlay) overlay.remove();
    }

    // Lockstep with frame ticker in sampleNow; light fallback only if ticker idle
    setInterval(() => {
        const now = performance.now();
        if (!window.__swLastObsTick || now - window.__swLastObsTick > 90) {
            window.__swLastObsTick = now;
            updateNoCoinObstacleEngine();
        }
    }, 120);

    window.__onGameOver = function() {
        stopRunTimer();
        cleanupCustomObstacles();
        updateEnergyHud();
    };
    window.__onGameReset = function() {
        hideCleanResultsOverlay();
        hideRunTimer();
        cleanupCustomObstacles();
        skateEnergy = 0;
        updateEnergyHud();
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
        msg.mid = msg.mid || (Date.now().toString(36) + outsideWorldRandom().toString(36).slice(2, 8));
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
                // Legacy real-time avatar packets are intentionally ignored.
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
        posSeq: 0,
        lastHostMsg: Date.now(),
        goAt: 0,
        worldSeed: null,
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

    function outsideWorldRandom() {
        return (window.__origMathRandom || Math.random)();
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
        const incomingSeq = Number(msg.seq) || 0;
        if (incomingSeq && coopTeammates[id] && incomingSeq <= (coopTeammates[id].lastSeq || 0)) return;
        let tm = coopTeammates[id];
        if (!tm) {
            tm = {
                id: id,
                nick: msg.sender.nick || 'Corredor',
                avatar: msg.sender.avatar || DEFAULT_AVATARS[0].url,
                charId: msg.charId || 'jake',
                currentX: msg.x || 0,
                currentY: msg.y || 0,
                currentZ: msg.z || 0,
                targetX: msg.x || 0,
                targetY: msg.y || 0,
                targetZ: msg.z || 0,
                anim: msg.anim || 'run',
                alive: msg.alive !== false,
                lastSeen: Date.now(),
                lastSeq: incomingSeq,
                mesh: null,
                tagEl: null
            };
            coopTeammates[id] = tm;
        } else {
            tm.targetX = msg.x || 0;
            tm.targetY = msg.y || 0;
            tm.targetZ = msg.z || 0;
            tm.anim = msg.anim || 'run';
            tm.charId = msg.charId || tm.charId || 'jake';
            tm.alive = msg.alive !== false;
            tm.lastSeen = Date.now();
            if (incomingSeq) tm.lastSeq = incomingSeq;
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

    function setGhostOpacity(root, opacity) {
        const seen = new Set();
        const applyMaterial = (owner, key) => {
            let material = owner && owner[key];
            if (!material) return;
            if (Array.isArray(material)) {
                owner[key] = material.map(m => m && typeof m.clone === 'function' ? m.clone() : m);
                material = owner[key];
            } else if (typeof material.clone === 'function') {
                try { owner[key] = material.clone(); material = owner[key]; } catch(e) {}
            }
            const list = Array.isArray(material) ? material : [material];
            list.forEach(m => {
                if (!m || typeof m !== 'object') return;
                if ('opacity' in m) m.opacity = opacity;
                if ('transparent' in m) m.transparent = true;
                if ('depthWrite' in m) m.depthWrite = false;
                if ('needsUpdate' in m) m.needsUpdate = true;
            });
        };
        const visit = node => {
            if (!node || typeof node !== 'object' || seen.has(node)) return;
            seen.add(node);
            if ('alpha' in node && typeof node.alpha === 'number') node.alpha = opacity;
            applyMaterial(node, 'material');
            applyMaterial(node, 'materials');
            if (node.view3d) visit(node.view3d);
            if (node.container) visit(node.container);
            if (node.parts) {
                if (Array.isArray(node.parts)) node.parts.forEach(visit);
                else Object.values(node.parts).forEach(visit);
            }
            if (node.children && typeof node.children.forEach === 'function') node.children.forEach(visit);
        };
        visit(root);
    }

    function spawnTeammateMesh(tm) {

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

    function getOrCreateNametagEl(tm) {

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
                        <span class="coop-tag-nick"></span>
                        <span class="coop-tag-dist">Sincronizando...</span>
                    </div>
                </div>
                <div class="coop-tag-arrow"></div>
            `;
            overlay.appendChild(tag);
        }
        const nick = tag.querySelector('.coop-tag-nick');
        const avatar = tag.querySelector('.coop-tag-av');
        if (nick) nick.textContent = tm.nick || 'Corredor';
        if (avatar && tm.avatar && avatar.src !== tm.avatar) avatar.src = tm.avatar;
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
            if (Date.now() - tm.lastSeen > 5000) {
                if (tm.mesh && tm.mesh.parent) { try { tm.mesh.parent.removeChild(tm.mesh); } catch(e) {} }
                removeEl(`coop-tag-${id}`);
                delete coopTeammates[id];
                return;
            }

            // Smooth position interpolation
            tm.currentX += (tm.targetX - tm.currentX) * 0.35;
            tm.currentY += (tm.targetY - tm.currentY) * 0.35;
            tm.currentZ += (tm.targetZ - tm.currentZ) * 0.35;

            // Spawn or update 3D mesh
            if (!tm.mesh || !tm.mesh.parent) {
                tm.mesh = spawnTeammateMesh(tm);
                tm._opacityApplied = false;
            }
            if (tm.mesh) {
                if (!tm._opacityApplied) {
                    setGhostOpacity(tm.mesh, 0.48);
                    tm._opacityApplied = true;
                }
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
            seed: Math.floor(outsideWorldRandom() * 10000000)
        };
        sendRoomMessage(msg);
        handleRoundStart(msg);
    }

    function handleRoundStart(msg) {
        if (!MP.isPartyLeader && msg.party) MP.party = msg.party.map(p => ({ ...p }));
        if (msg.matchType) MP.matchType = msg.matchType;
        MPX.worldSeed = msg.seed >>> 0;
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

            // Reset immediately before the game creates the first shared track chunks.
            if (MPX.worldSeed) setDeterministicRandom(MPX.worldSeed);
            try { window.app.nav.toGame(); } catch (e) {}
            setTimeout(restoreHeroMesh, 300);

            if (MP.isPartyLeader) hostStartBots();
        });
    }

    function removeEl(id) { const e = document.getElementById(id); if (e) e.remove(); }

    function runCountdown(seconds, label, done) {
        window.__runCountdown = runCountdown;
        removeEl('subway-cd-overlay');
        const countSec = Math.max(3, parseInt(seconds, 10) || 3); // Strictly 3 -> 2 -> 1 -> VAI!
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
                }, 280);
            }
        }, 700);
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
                MPX.botPlan[id] = 16000 + outsideWorldRandom() * 32000;
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
        restoreNormalRandom();
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
        if (!document.getElementById('subway-energy-widget')) {
            const meter = document.createElement('div');
            meter.id = 'subway-energy-widget';
            meter.style.display = 'none';
            meter.setAttribute('aria-label', 'Energia do skate: 0 de 8');
            meter.innerHTML = `
                <div class="energy-track"><div class="energy-fill" id="subway-energy-fill"></div><div class="energy-ticks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
            `;
            document.body.appendChild(meter);
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

        // Minimalist FPS Overlay Pill right below the timer (matching timer aesthetic)
        if (!document.getElementById('sw-fps-counter')) {
            const fpsEl = document.createElement('div');
            fpsEl.id = 'sw-fps-counter';
            fpsEl.className = 'sw-fps-counter';
            fpsEl.style.display = GFX_SETTINGS.showFps ? 'inline-flex' : 'none';
            fpsEl.innerHTML = `<span id="sw-fps-val" class="fps-value">0 FPS</span>`;
            document.body.appendChild(fpsEl);
            ensureFPSCounterHook();
        }

        // Single Clean Menu Button (Bottom Left)
        const oldOnl = document.getElementById('btn-subway-online-lobby');
        if (oldOnl) oldOnl.remove();
        if (!document.getElementById('btn-subway-unified-menu')) {
            const menuBtn = document.createElement('button');
            menuBtn.id = 'btn-subway-unified-menu';
            menuBtn.className = 'btn-subway-unified-menu';
            menuBtn.title = 'Configurações, Skins & Mod Menu';
            menuBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
            menuBtn.onclick = () => openUnifiedModal('modes');
            document.body.appendChild(menuBtn);
        }

        initProSkinHub();
    }

    // ==========================================
    // DEDICATED JAKE SKINS MANAGER (MENU-BASED)
    // ==========================================
    let hubSkinIndex = 0;
    let hubSkinAppliedInitial = false;
    let hubSwitching = false;

    let _johnSurfLogoImg = null;
    try {
        _johnSurfLogoImg = new Image();
        _johnSurfLogoImg.crossOrigin = 'anonymous';
        _johnSurfLogoImg.src = 'bundles/lasvegas/game-idle/train-start.png?v=logo1';
    } catch(e) {}

    const SKIN_THEMES = {
        jake_classic: { base: '#1d4ed8', accent: '#3b82f6', hi: '#93c5fd', isOriginal: true },
        jake_dark:    { base: '#0f172a', accent: '#334155', hi: '#94a3b8', isOriginal: true },
        jake_star:    { base: '#b45309', accent: '#f59e0b', hi: '#fde68a', isOriginal: true },
        jake_white:   { base: '#ffffff', accent: '#ffffff', hi: '#ffffff', sat: 0, con: 1.0, bri: 2.0, swatch: 'linear-gradient(135deg,#cbd5e1,#ffffff 60%,#f8fafc)' },
        jake_stick:   { base: '#09090b', accent: '#64748b', hi: '#e2e8f0', sat: 0.15, con: 1.35, bri: 0.35, swatch: 'linear-gradient(135deg,#09090b,#27272a 60%,#52525b)' },
        jake_cyan:    { base: '#0284c7', accent: '#22d3ee', hi: '#a5f3fc', sat: 1.45, con: 1.18, bri: 1.06, swatch: 'linear-gradient(135deg,#0369a1,#22d3ee 65%,#e0f2fe)' },
        jake_gold:    { base: '#d97706', accent: '#fbbf24', hi: '#fef08a', sat: 1.50, con: 1.20, bri: 1.08, swatch: 'linear-gradient(135deg,#92400e,#f59e0b 55%,#fef08a)' },
        jake_crimson: { base: '#be123c', accent: '#fb7185', hi: '#ffe4e6', sat: 1.48, con: 1.18, bri: 1.04, swatch: 'linear-gradient(135deg,#881337,#f43f5e 60%,#fecdd3)' },
        jake_violet:  { base: '#7c3aed', accent: '#c084fc', hi: '#f3e8ff', sat: 1.48, con: 1.18, bri: 1.06, swatch: 'linear-gradient(135deg,#4c1d95,#a855f7 60%,#f3e8ff)' },
        jake_emerald: { base: '#059669', accent: '#34d399', hi: '#d1fae5', sat: 1.45, con: 1.16, bri: 1.05, swatch: 'linear-gradient(135deg,#065f46,#10b981 60%,#d1fae5)' },
        jake_arctic:  { base: '#0ea5e9', accent: '#e0f2fe', hi: '#ffffff', sat: 1.25, con: 1.22, bri: 1.14, swatch: 'linear-gradient(135deg,#0284c7,#7dd3fc 55%,#ffffff)' },
        jake_lava:    { base: '#ea580c', accent: '#f97316', hi: '#fde047', sat: 1.55, con: 1.25, bri: 1.02, swatch: 'linear-gradient(135deg,#431407,#ea580c 55%,#fde047)' }
    };

    window.__SW_SKIN_TEX_CACHE__ = window.__SW_SKIN_TEX_CACHE__ || new Map();
    try {
        const _savedSkinId = localStorage.getItem('sw_selected_skin');
        if (_savedSkinId) {
            window.__SW_JAKE_SKIN_ID__ = _savedSkinId;
            if (_savedSkinId === 'jake_white') window.__SW_JAKE_WHITE__ = true;
            if (_savedSkinId === 'jake_stick') window.__SW_JAKE_BLACK__ = true;
        }
    } catch (e) {}
    window.__SW_BUILD_SKIN_TEX__ = function(origTex, skinId) {
        if (!origTex || !skinId || !SKIN_THEMES[skinId]) return null;
        const res = origTex.baseTexture && origTex.baseTexture.resource;
        const img = origTex.image || (res && (res.bitmap || res.source)) || (origTex.baseTexture && origTex.baseTexture.source);
        if (!img || (!img.width && !img.naturalWidth)) return null;
        const texKeyId = origTex.baseTexture ? (origTex.baseTexture.uid || 'bt') : (origTex.uuid || origTex.id || 'tex');
        const key = `${skinId}_${texKeyId}`;
        if (window.__SW_SKIN_TEX_CACHE__.has(key)) return window.__SW_SKIN_TEX_CACHE__.get(key);
        const TexCls = origTex.constructor;
        if (!TexCls || typeof TexCls.from !== 'function') return null;

        const w = Math.min(512, img.naturalWidth || img.width || 256);
        const h = Math.min(512, img.naturalHeight || img.height || 256);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        if (!ctx) return null;

        const parseHex = (hx) => {
            const v = parseInt(hx.replace('#', ''), 16);
            return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
        };
        const t = SKIN_THEMES[skinId];
        const cBase = parseHex(t.base);
        const cAcc = parseHex(t.accent);
        const cHi = parseHex(t.hi);

        ctx.drawImage(img, 0, 0, w, h);

        // Replace Subway Surfers logo on Jake's clothes with John Surf logo without any background box
        try {
            if (_johnSurfLogoImg && _johnSurfLogoImg.complete && _johnSurfLogoImg.naturalWidth) {
                const bx = Math.round(w * (67 / 256));
                const by = Math.round(h * (174 / 256));
                const bw = Math.round(w * (103 / 256));
                const bh = Math.round(h * (80 / 256));
                ctx.drawImage(_johnSurfLogoImg, bx, by, bw, bh);
            }
        } catch(e) {}

        if (!t.isOriginal) {
            try {
                const imgData = ctx.getImageData(0, 0, w, h);
                const d = imgData.data;
                for (let i = 0; i < d.length; i += 4) {
                    const a = d[i + 3];
                    if (a < 10) continue;
                    const r = d[i], g = d[i + 1], b = d[i + 2];
                    // Keep natural face/skin pixels intact unless obsidian or full white silhouette
                    const isSkin = skinId !== 'jake_stick' && skinId !== 'jake_white' && r > 155 && g > 105 && b > 70 && r > g + 10 && g >= b && (r - b) < 110;
                    if (isSkin) continue;
                    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    let nr, ng, nb;
                    if (skinId === 'jake_stick') {
                        const f = Math.min(1, luma);
                        nr = 4 + f * 14;
                        ng = 4 + f * 14;
                        nb = 6 + f * 18;
                    } else if (skinId === 'jake_white') {
                        nr = 255;
                        ng = 255;
                        nb = 255;
                    } else if (luma < 0.5) {
                        const p = luma * 2;
                        nr = cBase[0] * (0.22 + 0.78 * p) + cAcc[0] * p * 0.35;
                        ng = cBase[1] * (0.22 + 0.78 * p) + cAcc[1] * p * 0.35;
                        nb = cBase[2] * (0.22 + 0.78 * p) + cAcc[2] * p * 0.35;
                    } else {
                        const p = (luma - 0.5) * 2;
                        nr = cAcc[0] * (1 - p) + cHi[0] * p;
                        ng = cAcc[1] * (1 - p) + cHi[1] * p;
                        nb = cAcc[2] * (1 - p) + cHi[2] * p;
                    }
                    d[i] = Math.max(0, Math.min(255, Math.round(nr)));
                    d[i + 1] = Math.max(0, Math.min(255, Math.round(ng)));
                    d[i + 2] = Math.max(0, Math.min(255, Math.round(nb)));
                }
                ctx.putImageData(imgData, 0, 0);
            } catch (e) {}
        }

        const tex = TexCls.from(cv);
        try { tex.baseTexture.mipmap = origTex.baseTexture ? origTex.baseTexture.mipmap : 1; } catch(e) {}
        try { tex.baseTexture.update(); } catch(e) {}
        window.__SW_SKIN_TEX_CACHE__.set(key, tex);
        return tex;
    };

    function getSkinCatalog() {
        return [
            { skinId: 'jake_classic', charId: 'jake', outfit: 0, blackTex: false, whiteTex: false, tint: null,     title: 'Jake', sub: 'Clássico',      swatch: 'linear-gradient(135deg,#1d4ed8,#3b82f6 60%,#93c5fd)' },
            { skinId: 'jake_white',   charId: 'jake', outfit: 0, blackTex: false, whiteTex: true,  tint: 0xffffff, title: 'Jake', sub: 'Full White',     swatch: 'linear-gradient(135deg,#cbd5e1,#ffffff 60%,#f8fafc)' },
            { skinId: 'jake_dark',    charId: 'jake', outfit: 1, blackTex: false, whiteTex: false, tint: null,     title: 'Jake', sub: 'Dark Edition',  swatch: 'linear-gradient(135deg,#0f172a,#334155 60%,#94a3b8)' },
            { skinId: 'jake_star',    charId: 'jake', outfit: 2, blackTex: false, whiteTex: false, tint: null,     title: 'Jake', sub: 'Star Jacket',   swatch: 'linear-gradient(135deg,#b45309,#f59e0b 60%,#fde68a)' },
            { skinId: 'jake_stick',   charId: 'jake', outfit: 0, blackTex: true,  whiteTex: false, tint: 0x09090b, title: 'Jake', sub: 'Obsidian',      swatch: SKIN_THEMES.jake_stick.swatch },
            { skinId: 'jake_cyan',    charId: 'jake', outfit: 0, blackTex: false, whiteTex: false, tint: 0xe6f9ff, title: 'Jake', sub: 'Cyber Ciano',   swatch: SKIN_THEMES.jake_cyan.swatch },
            { skinId: 'jake_gold',    charId: 'jake', outfit: 2, blackTex: false, whiteTex: false, tint: 0xfff8dc, title: 'Jake', sub: 'Ouro 24K',      swatch: SKIN_THEMES.jake_gold.swatch },
            { skinId: 'jake_crimson', charId: 'jake', outfit: 1, blackTex: false, whiteTex: false, tint: 0xffeef2, title: 'Jake', sub: 'Carmesim Pro',  swatch: SKIN_THEMES.jake_crimson.swatch },
            { skinId: 'jake_violet',  charId: 'jake', outfit: 0, blackTex: false, whiteTex: false, tint: 0xf7edff, title: 'Jake', sub: 'Ultravioleta',  swatch: SKIN_THEMES.jake_violet.swatch },
            { skinId: 'jake_emerald', charId: 'jake', outfit: 0, blackTex: false, whiteTex: false, tint: 0xebfff6, title: 'Jake', sub: 'Esmeralda',     swatch: SKIN_THEMES.jake_emerald.swatch },
            { skinId: 'jake_arctic',  charId: 'jake', outfit: 2, blackTex: false, whiteTex: false, tint: 0xf0f9ff, title: 'Jake', sub: 'Ártico Gelo',   swatch: SKIN_THEMES.jake_arctic.swatch },
            { skinId: 'jake_lava',    charId: 'jake', outfit: 1, blackTex: false, whiteTex: false, tint: 0xfff2e6, title: 'Jake', sub: 'Magma Forge',   swatch: SKIN_THEMES.jake_lava.swatch },
        ];
    }

    function getCurrentSkinEntry() {
        const catalog = getSkinCatalog();
        const savedSkin = localStorage.getItem('sw_selected_skin') || '';
        const savedOutfit = parseInt(localStorage.getItem('sw_selected_outfit') || '0', 10) || 0;
        let idx = savedSkin ? catalog.findIndex(x => x.skinId === savedSkin) : -1;
        if (idx < 0) idx = catalog.findIndex(x => x.outfit === savedOutfit && !x.blackTex && x.tint == null);
        if (idx < 0) idx = 0;
        hubSkinIndex = idx;
        return catalog[idx];
    }

    async function applySkinSelection(entry, silent) {
        if (!entry || hubSwitching) return;
        hubSwitching = true;
        try {
            window.__SW_JAKE_BLACK__ = !!entry.blackTex;
            window.__SW_JAKE_WHITE__ = !!entry.whiteTex;
            window.__SW_JAKE_TINT__ = typeof entry.tint === 'number' ? entry.tint : null;
            window.__SW_JAKE_SKIN_ID__ = entry.skinId || 'jake_classic';
            localStorage.setItem('sw_selected_skin', entry.skinId || 'jake_classic');
            localStorage.setItem('sw_selected_char', 'jake');
            localStorage.setItem('sw_selected_outfit', String(entry.outfit || 0));

            const catalog = getSkinCatalog();
            const foundIdx = catalog.findIndex(x => x.skinId === entry.skinId);
            if (foundIdx >= 0) hubSkinIndex = foundIdx;
            renderSkinsPane();

            const app = window.app;
            if (app && app.user) {
                const alreadyLoaded = !!(app.library && typeof app.library.hasScene === 'function' && app.library.hasScene('jake-idle') && app.library.hasScene('jake-game'));
                if (!alreadyLoaded) {
                    try {
                        if (app.loader && typeof app.loader.loadCharacter === 'function') {
                            await app.loader.loadCharacter('jake', false);
                            app.loader.loadCharacter('jake', true).catch(() => {});
                        }
                        if (app.library && typeof app.library.refresh === 'function') {
                            app.library.refresh();
                        }
                    } catch(e) {}
                }
                app.user.character = 'jake';
                app.user.outfit = entry.outfit || 0;
                try {
                    if (app.user.onCharacterSettingsChange && app.user.onCharacterSettingsChange.dispatch) {
                        app.user.onCharacterSettingsChange.dispatch();
                    }
                } catch(e) {}
                try {
                    const hero = app.game && app.game.hero;
                    if (hero && hero.refreshScenes) {
                        hero.refreshScenes();
                        if (hero.anim && app.game.state === 0) {
                            hero.anim.play('paintIdle', { loop: true, sudden: true });
                        }
                    }
                } catch(e) {}
                try { app.user.save && app.user.save(); } catch(e) {}
                if (!silent) showHUDNotification(entry.title + ' — ' + entry.sub);
            }
        } finally {
            hubSwitching = false;
        }
    }

    window.__selectJakeSkin = function(skinId) {
        const entry = getSkinCatalog().find(x => x.skinId === skinId);
        if (entry) applySkinSelection(entry, false);
    };

    function renderSkinsPane() {
        const grid = document.getElementById('sw-skins-grid');
        if (!grid) return;
        const catalog = getSkinCatalog();
        const cur = getCurrentSkinEntry();
        grid.innerHTML = catalog.map(s => {
            const active = cur && cur.skinId === s.skinId;
            return `
                <button class="sw-skin-card ${active ? 'active' : ''}" onclick="window.__selectJakeSkin('${s.skinId}')">
                    <span class="sw-skin-swatch" style="background:${s.swatch}"></span>
                    <span class="sw-skin-info">
                        <span class="sw-skin-name">${s.sub}</span>
                        <span class="sw-skin-role">${active ? 'EQUIPADA' : 'JAKE'}</span>
                    </span>
                </button>
            `;
        }).join('');
    }

    window.__hideProHubNow = function() {
        const hub = document.getElementById('sw-skin-hub');
        if (hub) hub.remove();
        document.body.classList.remove('sw-hub-visible');
    };

    function updateSkinHubVisibility() {
        const hub = document.getElementById('sw-skin-hub');
        if (hub) hub.remove();
        document.body.classList.remove('sw-hub-visible');

        const app = window.app;
        if (!hubSkinAppliedInitial && app && app.user && app.loader) {
            hubSkinAppliedInitial = true;
            const entry = getCurrentSkinEntry();
            if (entry) applySkinSelection(entry, true);
        }
    }
    window.__syncProHubVisibility = updateSkinHubVisibility;

    function initProSkinHub() {
        window.__hideProHubNow();
        const entry = getCurrentSkinEntry();
        if (entry) {
            window.__SW_JAKE_BLACK__ = !!entry.blackTex;
            window.__SW_JAKE_WHITE__ = !!entry.whiteTex;
            window.__SW_JAKE_TINT__ = typeof entry.tint === 'number' ? entry.tint : null;
        }
        updateSkinHubVisibility();
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
                        <span class="modal-brand-sep"></span>
                        <span class="modal-brand-sub">Configurações & Menu</span>
                    </div>
                    <button class="btn-modal-close" id="btn-close-unified" title="Fechar">✕</button>
                </div>

                <!-- Tabs Navigation -->
                <div class="unified-tabs">
                    <button class="tab-btn" data-tab="modes" id="tab-btn-modes">MODO DE JOGO</button>
                    <button class="tab-btn" data-tab="skins" id="tab-btn-skins">SKINS</button>
                    <button class="tab-btn" data-tab="graphics" id="tab-btn-graphics">CONFIGURAÇÕES</button>
                    <button class="tab-btn" data-tab="multiplayer" id="tab-btn-multiplayer">MULTIPLAYER</button>
                    <button class="tab-btn" data-tab="records" id="tab-btn-records">RECORDES</button>
                </div>

                <!-- Tab 1: Game Modes -->
                <div class="tab-pane" id="pane-modes">
                    <div class="mod-card">
                        <div class="mod-info">
                            <span class="mod-title">Modo No Coin</span>
                            <span class="mod-desc">Moedas vermelhas — qualquer contato com moedas causa eliminação imediata</span>
                        </div>
                        <button class="btn-clean-toggle ${window.NO_COIN_MODE ? 'toggle-active-danger' : ''}" id="btn-toggle-nocoin">
                            <span class="toggle-indicator"></span>
                            <span class="toggle-label">${window.NO_COIN_MODE ? 'ATIVADO' : 'DESATIVADO'}</span>
                        </button>
                    </div>
                </div>

                <!-- Dedicated Jake Skins Tab -->
                <div class="tab-pane" id="pane-skins">
                    <div class="sw-skins-head">Selecione o visual do personagem</div>
                    <div class="sw-skins-grid" id="sw-skins-grid"></div>
                </div>

                <!-- Tab 2: Settings, Audio & Graphics -->
                <div class="tab-pane" id="pane-graphics">
                    <!-- Volume Slider Card (Default 30%) -->
                    <div class="subway-setting-card">
                        <div class="setting-row-top">
                            <div class="setting-text-col">
                                <span class="setting-title">Volume do Jogo</span>
                                <span class="setting-desc">Áudio geral da música e efeitos sonoros</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-volume">${GFX_SETTINGS.volume === 0 ? 'Mudo (0%)' : (GFX_SETTINGS.volume + '%' + (GFX_SETTINGS.volume === 30 ? ' (Padrão)' : ''))}</span>
                        </div>
                        <div class="sat-slider-wrap">
                            <input type="range" id="slider-volume" min="0" max="100" step="1" value="${GFX_SETTINGS.volume}" oninput="window.__setGameVolume(this.value)" />
                            <div class="sat-presets-row">
                                <button class="btn-sat-chip" onclick="window.__setGameVolume(0)">0% Mudo</button>
                                <button class="btn-sat-chip" onclick="window.__setGameVolume(30)">30% Padrão</button>
                                <button class="btn-sat-chip" onclick="window.__setGameVolume(60)">60%</button>
                                <button class="btn-sat-chip" onclick="window.__setGameVolume(100)">100%</button>
                            </div>
                        </div>
                    </div>

                    <div class="settings-grid-rows">
                        <!-- Unlimited FPS Setting -->
                        <div class="subway-setting-row" onclick="window.__cycleFPS()" title="Toque para alternar taxa de quadros">
                            <div class="setting-text-col">
                                <span class="setting-title">Taxa de Quadros (FPS)</span>
                                <span class="setting-desc">Limite de renderização por segundo</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-fps">${getFPSLabel(GFX_SETTINGS.fps)}</span>
                        </div>

                        <!-- Show FPS Overlay Setting -->
                        <div class="subway-setting-row" onclick="window.__toggleShowFPS()" title="Mostrar contador de FPS abaixo do timer">
                            <div class="setting-text-col">
                                <span class="setting-title">Mostrar FPS na Tela</span>
                                <span class="setting-desc">Exibe contador discreto abaixo do timer</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-showfps">${GFX_SETTINGS.showFps ? 'Ativado' : 'Desativado'}</span>
                        </div>

                        <!-- Shaders & Reformulated Shadows Setting -->
                        <div class="subway-setting-row" onclick="window.__cycleShaders()" title="Toque para alternar Shaders e Sombras 3D">
                            <div class="setting-text-col">
                                <span class="setting-title">Shaders & Sombras 3D</span>
                                <span class="setting-desc">Iluminação direcional e sombras em tempo real</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-shaders">${getShaderLabel(GFX_SETTINGS.shaders)}</span>
                        </div>

                        <!-- Motion Blur Setting -->
                        <div class="subway-setting-row" onclick="window.__cycleMotionBlur()" title="Toque para alternar o Motion Blur">
                            <div class="setting-text-col">
                                <span class="setting-title">Motion Blur</span>
                                <span class="setting-desc">Desfoque de movimento em alta velocidade</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-motionblur">${getMotionBlurLabel(GFX_SETTINGS.motionBlur)}</span>
                        </div>

                        <!-- Proporção da Tela (Tela Esticada) Setting -->
                        <div class="subway-setting-row" onclick="window.__cycleAspectRatio()" title="Mude a proporção da tela para tela esticada (4:3, 16:10)">
                            <div class="setting-text-col">
                                <span class="setting-title">Proporção da Tela (Esticada)</span>
                                <span class="setting-desc">4:3 Esticada (Pro / FPS), 16:10 ou Nativa</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-aspectratio">${getAspectRatioLabel(GFX_SETTINGS.aspectRatio)}</span>
                        </div>

                        <!-- Contorno Preto nas Moedas Setting -->
                        <div class="subway-setting-row" onclick="window.__toggleCoinOutline()" title="Contorno preto nas moedas para melhor visibilidade">
                            <div class="setting-text-col">
                                <span class="setting-title">Contorno Preto nas Moedas</span>
                                <span class="setting-desc">Destaca as moedas com borda nítida</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-coinoutline">${getCoinOutlineLabel(GFX_SETTINGS.coinOutline)}</span>
                        </div>

                        <!-- No Revive (Hardcore) Setting -->
                        <div class="subway-setting-row" onclick="window.__toggleNoRevive()" title="Bloqueia reviver por chave/moeda ou anúncio">
                            <div class="setting-text-col">
                                <span class="setting-title">Sem Revive</span>
                                <span class="setting-desc">Bloqueia reviver após colisão (chaves e ad)</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-norevive">${GFX_SETTINGS.noRevive ? 'Ativado' : 'Desativado'}</span>
                        </div>
                    </div>

                    <!-- Saturation Slider Card -->
                    <div class="subway-setting-card">
                        <div class="setting-row-top">
                            <div class="setting-text-col">
                                <span class="setting-title">Saturação e Vibração</span>
                                <span class="setting-desc">Intensidade e vibração das cores (até 300%)</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-saturation">${GFX_SETTINGS.saturation}%</span>
                        </div>
                        <div class="sat-slider-wrap">
                            <input type="range" id="slider-saturation" min="50" max="300" step="5" value="${GFX_SETTINGS.saturation}" oninput="window.__setSaturation(this.value)" />
                            <div class="sat-presets-row">
                                <button class="btn-sat-chip" onclick="window.__setSaturation(100)">100% Padrão</button>
                                <button class="btn-sat-chip" onclick="window.__setSaturation(160)">160% Vívido</button>
                                <button class="btn-sat-chip" onclick="window.__setSaturation(220)">220% Forte</button>
                                <button class="btn-sat-chip" onclick="window.__setSaturation(300)">300% Máximo</button>
                            </div>
                        </div>
                    </div>

                    <!-- Contrast Slider Card -->
                    <div class="subway-setting-card">
                        <div class="setting-row-top">
                            <div class="setting-text-col">
                                <span class="setting-title">Contraste da Imagem</span>
                                <span class="setting-desc">Acentuação de luz e sombras (até 300%)</span>
                            </div>
                            <span class="setting-pill" id="val-gfx-contrast">${GFX_SETTINGS.contrast}%</span>
                        </div>
                        <div class="sat-slider-wrap">
                            <input type="range" id="slider-contrast" min="50" max="300" step="5" value="${GFX_SETTINGS.contrast}" oninput="window.__setContrast(this.value)" />
                            <div class="sat-presets-row">
                                <button class="btn-sat-chip" onclick="window.__setContrast(85)">85% Suave</button>
                                <button class="btn-sat-chip" onclick="window.__setContrast(100)">100% Padrão</button>
                                <button class="btn-sat-chip" onclick="window.__setContrast(150)">150% Alto</button>
                                <button class="btn-sat-chip" onclick="window.__setContrast(220)">220% Forte</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab 2: Online Multiplayer (Clean Obsidian Hub) -->
                <div class="tab-pane" id="pane-multiplayer">
                    <div class="lobby-header-bar">
                        <div class="lobby-room-badge">
                            <span class="live-dot"></span>
                            <span class="room-lbl">SALA</span>
                            <span class="room-code-tag" id="lobby-room-code">#${(MP.roomId || '').replace('room_', '').slice(0, 8)}</span>
                            <button class="btn-copy-code" onclick="window.__copyRoomLink()" title="Copiar link da sala">Copiar</button>
                        </div>

                        <div class="lobby-join-box">
                            <input type="text" id="input-join-room" placeholder="Código da sala..." maxlength="15" />
                            <button class="btn-join-room" onclick="window.__joinRoomByInput()">Entrar</button>
                        </div>

                        <div class="lobby-user-profile">
                            <div class="user-avatar-wrap" onclick="window.__promptAvatarUrl()" title="Alterar foto por URL">
                                <img id="lobby-my-avatar" src="${myProfile.avatar}" alt="Avatar" />
                            </div>
                            <div class="user-meta-wrap">
                                <div class="user-fields-row">
                                    <input type="text" id="input-my-nick" value="${myProfile.nick}" maxlength="14" placeholder="Seu Nick" onchange="window.__saveMyNick(this.value)" onblur="window.__saveMyNick(this.value)" />
                                    <input type="text" id="input-my-avatar-url" value="${myProfile.avatar.startsWith('http') ? myProfile.avatar : ''}" placeholder="URL da foto..." onchange="window.__saveAvatarUrl(this.value)" onblur="window.__saveAvatarUrl(this.value)" />
                                </div>
                                <div class="avatar-dots-bar">
                                    ${DEFAULT_AVATARS.map(av => `
                                        <img class="avatar-dot-chip ${av.url === myProfile.avatar ? 'active' : ''}" src="${av.url}" title="${av.name}" onclick="window.__selectPresetAvatar('${av.url}')" />
                                    `).join('')}
                                    <button class="btn-avatar-url-chip" onclick="window.__promptAvatarUrl()" title="Inserir URL">+ URL</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="lobby-grid">
                        <div class="lobby-column party-col">
                            <div class="mp-mode-toggle-group">
                                <button type="button" class="btn-mp-mode ${MP.matchType === '1v1' ? 'active' : ''}" data-mode="1v1" onclick="window.__setMPMatchType('1v1')">Duelo 1v1</button>
                                <button type="button" class="btn-mp-mode ${MP.matchType === 'tournament' ? 'active' : ''}" data-mode="tournament" onclick="window.__setMPMatchType('tournament')">Torneio (5P)</button>
                            </div>

                            <div class="col-header">
                                <div class="col-title-wrap">
                                    <h3 id="lobby-party-title">${MP.matchType === '1v1' ? `DUELO 1V1 (${MP.party.length}/2)` : `TORNEIO (${MP.party.length}/5)`}</h3>
                                    <span class="party-hint" id="lobby-party-desc">${MP.matchType === '1v1' ? '1 Rodada · Maior sobrevivência vence' : '3 Rodadas · Até 5 jogadores · 5s de intervalo'}</span>
                                </div>
                                <button class="btn-add-bot" onclick="window.__addTestBot()" title="Adicionar bot para treinar">+ Bot</button>
                            </div>

                            <div class="party-slots-container" id="party-slots"></div>

                            <div class="party-bottom-actions">
                                <button id="btn-toggle-ready" class="btn-ready ${MP.isReady ? 'ready-on' : 'ready-off'}">
                                    ${MP.isReady ? 'Pronto ✓' : 'Dar Pronto'}
                                </button>
                                <button id="btn-start-match" class="btn-start-match" ${checkCanStartMatch() ? '' : 'disabled'}>
                                    ${MP.matchType === '1v1' ? 'Iniciar 1v1' : 'Iniciar Torneio'}
                                </button>
                                <button id="btn-leave-party" class="btn-leave-room" onclick="window.__leaveParty()">Sair</button>
                            </div>
                        </div>

                        <div class="lobby-column players-col">
                            <div class="col-header">
                                <div class="col-title-wrap">
                                    <h3>Jogadores Online</h3>
                                    <span class="party-hint">Convide corredores para a sala</span>
                                </div>
                                <button class="btn-refresh-online" onclick="window.__refreshOnline()">Atualizar</button>
                            </div>
                            <div class="online-players-list" id="online-players-list"></div>
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
        const btnUnl = document.getElementById('btn-toggle-unlimited'); if (btnUnl) btnUnl.onclick = toggleUnlimitedMode;
        document.getElementById('btn-toggle-nocoin').onclick = toggleNoCoinMode;
        const btnSave = document.getElementById('btn-save-profile'); if (btnSave) btnSave.onclick = saveLobbyProfile;
        document.getElementById('btn-toggle-ready').onclick = toggleReady;
        document.getElementById('btn-start-match').onclick = requestStartMatch;

        switchTab(defaultTab || 'modes');
        renderSkinsPane();
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

            /* Minimal horizontal skate charge bar */
            #subway-energy-widget {
                position: fixed; left: 50%; bottom: max(18px, env(safe-area-inset-bottom, 18px)); transform: translateX(-50%);
                z-index: 99990; width: min(260px, 58vw); height: 12px; padding: 2px;
                box-sizing: border-box; border: 1px solid rgba(176, 225, 235, .42); border-radius: 99px;
                background: rgba(5, 18, 28, .82); box-shadow: 0 2px 10px rgba(0,0,0,.42), inset 0 1px 2px rgba(0,0,0,.7);
                user-select: none; pointer-events: none;
            }
            #subway-energy-widget .energy-track { position:relative; width:100%; height:100%; overflow:hidden; border-radius:99px; background:rgba(10,28,39,.92); }
            #subway-energy-widget .energy-fill { position:absolute; inset:0 auto 0 0; width:0%; border-radius:99px; background:linear-gradient(90deg,#086dca,#178df0 70%,#7bd3ff); box-shadow:0 0 8px rgba(35,151,255,.58); transition:width .32s cubic-bezier(.2,.8,.2,1); }
            #subway-energy-widget .energy-ticks { position:absolute; inset:0; display:flex; justify-content:space-evenly; pointer-events:none; }
            #subway-energy-widget .energy-ticks i { width:1px; height:100%; background:rgba(4,20,32,.72); }
            #subway-energy-widget.is-ready { border-color:rgba(94,195,255,.86); box-shadow:0 0 12px rgba(34,145,255,.4), inset 0 0 5px rgba(130,206,255,.24); }
            #subway-energy-widget.is-active .energy-fill { background:linear-gradient(90deg,#c27415,#e8b443,#fff0bd); box-shadow:0 0 8px rgba(251,191,36,.54); }
            #subway-energy-toast { position:fixed; left:50%; bottom:42px; transform:translate(-50%,6px); z-index:99991; padding:8px 12px; border:1px solid rgba(103,232,249,.45); border-radius:10px; background:rgba(5,18,31,.9); color:#dffaff; font:800 10px/1.2 Arial,sans-serif; letter-spacing:.7px; box-shadow:0 6px 20px rgba(0,0,0,.35); opacity:0; pointer-events:none; transition:opacity .16s,transform .16s; }
            #subway-energy-toast.visible { opacity:1; transform:translate(-50%,0); }
            @media(max-width:600px) { #subway-energy-widget { width:min(228px,58vw); height:10px; bottom:max(14px, env(safe-area-inset-bottom, 14px)); } #subway-energy-toast { bottom:34px; } }
            
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

            
            /* Canvas Saturation, Contrast & Ultra-Low Latency */
            canvas {
                touch-action: none !important;
                -webkit-touch-callout: none !important;
                user-select: none !important;
                filter: saturate(var(--game-saturation, 100%)) contrast(var(--game-contrast, 100%));
            }

            .gfx-state-pill {
                min-width: 38px; padding: 5px 8px; border-radius: 999px;
                border: 1px solid rgba(148,163,184,.28); color: #94a3b8;
                background: rgba(15,23,42,.9); font: 900 10px/1 Arial,sans-serif;
                letter-spacing: .8px; text-align: center;
            }
            .gfx-state-pill.is-on {
                border-color: rgba(56,189,248,.7); color: #dff7ff;
                background: linear-gradient(180deg,rgba(14,165,233,.46),rgba(3,105,161,.3));
                box-shadow: 0 0 14px rgba(56,189,248,.22);
            }

            /* Clean Pro Studio Settings & Controls */
            .settings-grid-rows {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                margin-bottom: 10px;
            }
            @media (max-width: 600px) {
                .settings-grid-rows { grid-template-columns: 1fr; }
            }
            .subway-setting-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 11px 14px;
                background: #171a21;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                cursor: pointer;
                user-select: none;
                transition: background 0.14s ease, border-color 0.14s ease;
                touch-action: manipulation;
            }
            .subway-setting-row:hover {
                background: #1d212a;
                border-color: rgba(255, 255, 255, 0.16);
            }
            .subway-setting-row:active {
                transform: scale(0.99);
            }
            .setting-text-col {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
                flex: 1;
            }
            .setting-title {
                font-size: 13px;
                font-weight: 700;
                color: #f3f4f6;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                line-height: 1.25;
            }
            .setting-desc {
                font-size: 11px;
                font-weight: 500;
                color: #8b94a3;
                line-height: 1.3;
            }
            .setting-pill {
                font-size: 11px;
                font-weight: 700;
                color: #e2e8f0;
                background: #232834;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                padding: 4px 9px;
                white-space: nowrap;
                font-variant-numeric: tabular-nums;
            }
            .setting-row-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 10px;
            }
            .subway-setting-card {
                padding: 12px 14px;
                margin-bottom: 10px;
                background: #171a21;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
            }
            .sat-slider-wrap {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .sat-slider-wrap input[type="range"] {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 6px;
                border-radius: 999px;
                background: #262b36;
                outline: none;
                cursor: pointer;
            }
            .sat-slider-wrap input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #f8fafc;
                border: 2px solid #0f172a;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
                cursor: pointer;
            }
            .sat-presets-row {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .btn-sat-chip {
                background: #212630;
                border: 1px solid rgba(255, 255, 255, 0.09);
                color: #cbd5e1;
                font-size: 11px;
                font-weight: 600;
                padding: 4px 10px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
                font-family: inherit;
            }
            .btn-sat-chip:hover {
                background: #f8fafc;
                color: #111318;
                border-color: #f8fafc;
            }

            /* Lightweight Stopwatch HUD (no GPU blur over WebGL) */
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
                background: rgba(16, 18, 24, 0.88);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 9999px;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
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
            .sw-fps-counter {
                position: fixed;
                top: 58px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99998;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 3px 12px;
                background: rgba(15, 23, 42, 0.82);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 16px;
                color: #f8fafc;
                font-family: monospace;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.5px;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
                user-select: none;
                pointer-events: none;
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
                padding: 0 13px 0 10px;
                display: flex;
                align-items: center;
                gap: 7px;
                background: #14171d;
                color: #e5e7eb;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 10px;
                cursor: pointer;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.42);
                font-weight: 700;
                font-size: 11px;
                letter-spacing: 0.6px;
                text-transform: uppercase;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
                user-select: none;
                -webkit-user-select: none;
            }
            .btn-subway-online-lobby:hover {
                background: #1f242d;
                border-color: rgba(255, 255, 255, 0.28);
                color: #fff;
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
                top: auto;
                bottom: max(18px, env(safe-area-inset-bottom, 18px));
                left: 16px;
                z-index: 99998;
                width: 42px;
                height: 42px;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #14171d;
                color: #e2e8f0;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 12px;
                cursor: pointer;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.42);
                transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
            }
            .sw-skins-head {
                font-size: 12px;
                font-weight: 600;
                color: #8b94a3;
                margin-bottom: 10px;
            }
            .sw-skins-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
                gap: 8px;
            }
            .sw-skin-card {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-radius: 10px;
                background: #171a21;
                border: 1px solid rgba(255, 255, 255, 0.08);
                color: #f3f4f6;
                cursor: pointer;
                text-align: left;
                transition: border-color 0.14s ease, background 0.14s ease;
            }
            .sw-skin-card:hover {
                background: #1d212a;
                border-color: rgba(255, 255, 255, 0.22);
            }
            .sw-skin-card.active {
                background: #202531;
                border-color: #f8fafc;
            }
            .sw-skin-swatch {
                width: 24px;
                height: 24px;
                border-radius: 6px;
                flex-shrink: 0;
                border: 1px solid rgba(255, 255, 255, 0.25);
            }
            .sw-skin-info {
                display: flex;
                flex-direction: column;
                min-width: 0;
            }
            .sw-skin-name {
                font-size: 13px;
                font-weight: 700;
                color: #f9fafb;
            }
            .sw-skin-role {
                font-size: 10px;
                font-weight: 600;
                color: #9ca3af;
            }
            .btn-subway-unified-menu:hover {
                background: #1f242d;
                border-color: rgba(255, 255, 255, 0.28);
                color: #fff;
            }
            .btn-subway-unified-menu svg {
                width: 17px;
                height: 17px;
            }

            /* Clean Professional 3D Skin Showcase Hub */
            body.sw-hub-visible #subway-top-timer-wrap { display: none !important; }
            body.sw-hub-visible #btn-subway-online-lobby { display: none !important; }
            body.sw-hub-visible #btn-subway-unified-menu { opacity: 0.65; }
            #sw-skin-hub {
                position: fixed;
                inset: 0;
                z-index: 9992;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .sw-hub-arrow {
                position: fixed;
                top: 50%;
                transform: translateY(-50%);
                width: 54px;
                height: 54px;
                border-radius: 50%;
                border: 1px solid rgba(255, 255, 255, 0.2);
                background: rgba(10, 16, 32, 0.56);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                pointer-events: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
                transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
            }
            .sw-hub-prev { left: 22px; }
            .sw-hub-next { right: 22px; }
            .sw-hub-arrow:hover {
                background: rgba(30, 58, 118, 0.85);
                border-color: rgba(125, 211, 252, 0.65);
                transform: translateY(-50%) scale(1.07);
            }
            .sw-hub-arrow:active {
                transform: translateY(-50%) scale(0.94);
            }
            .sw-hub-bar {
                position: fixed;
                left: 50%;
                bottom: 24px;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 18px;
                padding: 10px 14px 10px 22px;
                min-width: 290px;
                max-width: calc(100vw - 32px);
                border-radius: 999px;
                background: rgba(10, 16, 32, 0.68);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.16);
                box-shadow: 0 14px 36px rgba(0, 0, 0, 0.52);
                pointer-events: auto;
            }
            .sw-hub-meta {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
                min-width: 0;
            }
            .sw-hub-name {
                color: #ffffff;
                font-size: 16px;
                font-weight: 800;
                letter-spacing: 0.2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .sw-hub-sub-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .sw-hub-sub {
                color: #7dd3fc;
                font-size: 12px;
                font-weight: 700;
            }
            .sw-hub-count {
                color: rgba(255, 255, 255, 0.55);
                font-size: 11px;
                font-weight: 700;
            }
            .sw-hub-play {
                border: none;
                border-radius: 999px;
                padding: 10px 26px;
                font-size: 14px;
                font-weight: 900;
                letter-spacing: 0.7px;
                color: #062814;
                background: linear-gradient(135deg, #4ade80, #22c55e);
                box-shadow: 0 6px 18px rgba(34, 197, 94, 0.42);
                cursor: pointer;
                transition: transform 0.15s ease, filter 0.15s ease;
            }
            .sw-hub-play:hover {
                filter: brightness(1.08);
                transform: translateY(-1px);
            }
            .sw-hub-play:active {
                transform: scale(0.96);
            }

            /* Modal Backdrop & Structure */
            .subway-modal-backdrop {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(8, 10, 14, 0.80);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .subway-modal-box {
                background: #101216;
                color: #f3f4f6;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                box-shadow: 0 24px 64px rgba(0, 0, 0, 0.78);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                max-width: 92vw;
                max-height: 88vh;
            }
            .unified-box { width: 720px; }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 18px;
                background: #14171d;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            }
            .modal-header-branding {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .modal-brand-title {
                font-size: 13px;
                font-weight: 800;
                letter-spacing: 0.6px;
                color: #f9fafb;
            }
            .modal-brand-sep {
                width: 1px;
                height: 13px;
                background: rgba(255, 255, 255, 0.16);
            }
            .modal-brand-sub {
                font-size: 12px;
                font-weight: 500;
                color: #8b94a3;
            }
            .btn-modal-close {
                background: transparent;
                border: 1px solid transparent;
                color: #9ca3af;
                font-size: 15px;
                cursor: pointer;
                padding: 4px 9px;
                border-radius: 6px;
                transition: background 0.15s, color 0.15s;
            }
            .btn-modal-close:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }

            /* Unified Tabs */
            .unified-tabs {
                display: flex;
                background: #121419;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07);
                padding: 0 12px;
                gap: 4px;
                overflow-x: auto;
            }
            .tab-btn {
                padding: 11px 14px;
                background: none;
                border: none;
                color: #8b94a3;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.5px;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: color 0.15s ease, border-color 0.15s ease;
                margin-bottom: -1px;
                white-space: nowrap;
            }
            .tab-btn:hover { color: #e5e7eb; }
            .tab-btn.active {
                color: #ffffff;
                border-bottom-color: #f8fafc;
            }
            .tab-pane {
                display: none;
                padding: 16px 18px;
                overflow-x: hidden;
                overflow-y: auto;
            }
            .tab-pane.active { display: block; }

            /* Modes Tab */
            .mod-card {
                background: #171a21;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                padding: 14px 16px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                transition: border-color 0.15s;
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

            /* Obsidian Minimalist Lobby & Room Connect */
            .lobby-header-bar {
                display: grid;
                grid-template-columns: auto 1fr auto;
                align-items: center;
                gap: 10px;
                background: #171a21;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                padding: 10px 12px;
                margin-bottom: 12px;
            }
            .lobby-room-badge {
                display: flex;
                align-items: center;
                gap: 7px;
            }
            .live-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #10b981;
            }
            .room-lbl {
                color: #8b94a3;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            .room-code-tag {
                background: #101216;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 6px;
                padding: 3px 8px;
                color: #f8fafc;
                font-weight: 700;
                font-family: ui-monospace, SFMono-Regular, monospace;
                letter-spacing: 0.6px;
                font-size: 12px;
            }
            .btn-copy-code {
                background: #202531;
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #e5e7eb;
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.15s, border-color 0.15s;
            }
            .btn-copy-code:hover {
                background: #2b3140;
                border-color: rgba(255, 255, 255, 0.25);
                color: #fff;
            }

            .lobby-user-profile {
                grid-column: 1 / -1;
                display: flex;
                align-items: center;
                gap: 10px;
                background: #12151b;
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 8px;
                padding: 8px 10px;
            }
            .user-avatar-wrap img {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 1.5px solid rgba(255, 255, 255, 0.28);
                object-fit: cover;
                display: block;
                cursor: pointer;
            }
            .user-meta-wrap {
                display: flex;
                flex-direction: column;
                gap: 5px;
                flex: 1;
                min-width: 0;
            }
            .user-fields-row {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            #input-my-nick, #input-my-avatar-url {
                background: #101216;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 6px;
                color: #f8fafc;
                font-size: 12px;
                font-weight: 600;
                padding: 4px 8px;
                outline: none;
                transition: border-color 0.15s;
            }
            #input-my-nick { width: 120px; }
            #input-my-avatar-url { flex: 1; min-width: 120px; color: #9ca3af; font-weight: 500; }
            #input-my-nick:focus, #input-my-avatar-url:focus {
                border-color: rgba(255, 255, 255, 0.4);
            }
            .avatar-dots-bar {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .avatar-dot-chip {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                opacity: 0.55;
                cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.22);
                transition: opacity 0.15s, border-color 0.15s, transform 0.15s;
            }
            .avatar-dot-chip:hover, .avatar-dot-chip.active {
                opacity: 1;
                border-color: #ffffff;
                transform: scale(1.12);
            }
            .btn-avatar-url-chip {
                background: #1c2029;
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #9ca3af;
                border-radius: 5px;
                padding: 2px 7px;
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
            }

            .lobby-join-box {
                display: flex;
                align-items: center;
                gap: 6px;
                justify-self: end;
            }
            .lobby-join-box input {
                background: #101216;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 6px;
                padding: 5px 9px;
                color: #fff;
                font-size: 12px;
                width: 118px;
                outline: none;
            }
            .lobby-join-box input:focus {
                border-color: rgba(255, 255, 255, 0.4);
            }
            .btn-join-room {
                background: #f8fafc;
                color: #0b0d10;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                transition: opacity 0.15s;
            }
            .btn-join-room:hover { opacity: 0.9; }

            /* Grid Layout */
            .lobby-grid {
                display: grid;
                grid-template-columns: 1.15fr 0.85fr;
                gap: 12px;
            }
            .lobby-column {
                background: #171a21;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                min-width: 0;
            }
            .col-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            }
            .col-title-wrap h3 {
                margin: 0;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.4px;
                color: #f9fafb;
            }
            .party-hint {
                display: block;
                font-size: 11px;
                color: #8b94a3;
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
                border: 1px solid rgba(255, 255, 255, 0.12);
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                transition: background 0.15s, border-color 0.15s;
            }
            .btn-ready.ready-on {
                background: #10b981;
                border-color: #10b981;
                color: #062118;
            }
            .btn-ready.ready-off {
                background: #202531;
                color: #e5e7eb;
            }
            .btn-ready.ready-off:hover {
                background: #293040;
            }
            .btn-start-match {
                flex: 1.4;
                height: 38px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                font-size: 12px;
                font-weight: 700;
                cursor: not-allowed;
                background: #14171d;
                color: #6b7280;
                transition: background 0.15s, color 0.15s;
            }
            .btn-start-match.can-start {
                cursor: pointer;
                background: #f8fafc;
                border-color: #f8fafc;
                color: #0b0d10;
            }
            .btn-start-match.can-start:hover {
                background: #e5e7eb;
            }
            .btn-leave-room {
                height: 38px;
                padding: 0 12px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: #12151b;
                color: #9ca3af;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.15s, color 0.15s;
            }
            .btn-leave-room:hover {
                background: #1f242d;
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
            .subway-energy-star-burst {
                position: fixed; inset: 0; z-index: 100001; overflow: hidden;
                pointer-events: none;
                background: radial-gradient(circle at 50% 55%, rgba(20,184,255,.26), rgba(0,116,255,.12) 28%, transparent 58%);
                box-shadow: inset 0 0 110px rgba(0,153,255,.72);
                animation: energyStarScreenFlash .62s ease-out forwards;
            }
            .energy-pickup-star, .energy-pickup-star-glint {
                position: absolute; left: 50%; top: 54%; display: block;
                transform: translate(-50%,-50%); color: #dffaff;
                font: 900 clamp(110px, 27vw, 260px)/1 Arial,sans-serif;
                -webkit-text-stroke: 3px #36c8ff;
                text-shadow: 0 0 14px #fff, 0 0 38px #18aaff, 0 0 86px #087bff;
                animation: energyPickupStar .62s cubic-bezier(.14,.78,.22,1) forwards;
            }
            .energy-pickup-star-glint {
                color: #fff; font-size: clamp(42px, 10vw, 96px);
                -webkit-text-stroke: 1px #a5f3ff;
                animation: energyPickupGlint .62s cubic-bezier(.15,.8,.2,1) forwards;
            }
            .subway-coin-shatter {
                position: fixed; inset: 0; z-index: 100002; pointer-events: none;
                color: var(--coin-burst-color, #ffd84a);
                filter: drop-shadow(0 0 18px var(--coin-burst-color, #ffd84a));
            }
            .coin-shatter-flash {
                position: absolute; inset: 0;
                background: radial-gradient(circle at 50% 59%, color-mix(in srgb, var(--coin-burst-color) 42%, transparent), transparent 38%);
                animation: coinShatterFlash .24s ease-out forwards;
            }
            .coin-shatter-ring {
                position: absolute; left: 50%; top: 59%; width: 92px; height: 92px;
                margin: -46px 0 0 -46px; border: 7px solid var(--coin-burst-color);
                border-radius: 50%; box-shadow: 0 0 24px var(--coin-burst-color), inset 0 0 18px #fff7;
                animation: coinShatterRing .78s cubic-bezier(.12,.72,.24,1) forwards;
            }
            .coin-shatter-ring-inner {
                width: 54px; height: 54px; margin: -27px 0 0 -27px;
                border-width: 4px; animation-delay: .035s; opacity: .85;
            }
            .coin-shatter-core {
                position: absolute; left: 50%; top: 59%; width: 72px; height: 72px;
                margin: -36px 0 0 -36px; display: grid; place-items: center;
                border: 4px solid #fff; border-radius: 50%; box-sizing: border-box;
                background: radial-gradient(circle at 35% 30%, #fffbd0, var(--coin-burst-color) 75%);
                color: #fff; font: 900 48px/1 Arial,sans-serif;
                text-shadow: 0 2px 0 #a34b00, 0 0 14px #fff;
                box-shadow: 0 0 30px var(--coin-burst-color), 0 6px 0 #6f3500;
                animation: coinShatterCore .5s cubic-bezier(.15,.9,.2,1) forwards;
            }
            .coin-broken-wrapper {
                position: absolute; left: 50%; top: 59%; width: 84px; height: 84px;
                margin: -42px 0 0 -42px; pointer-events: none;
            }
            .coin-half {
                position: absolute; width: 42px; height: 84px; top: 0;
            }
            .coin-half-left {
                left: 0; transform-origin: left bottom;
                animation: coinSplitLeft .48s cubic-bezier(.12,.8,.2,1) forwards;
            }
            .coin-half-right {
                left: 42px; transform-origin: right bottom;
                animation: coinSplitRight .48s cubic-bezier(.12,.8,.2,1) forwards;
            }
            .coin-half-svg {
                width: 42px; height: 84px; display: block;
                filter: drop-shadow(0 0 12px #ff1e38);
            }
            .coin-crack-spark {
                position: absolute; left: 50%; top: 50%; margin: -22px 0 0 -22px;
                width: 44px; height: 44px; font-size: 34px; display: grid; place-items: center;
                animation: coinCrackFlash .38s ease-out forwards;
            }
            @keyframes coinSplitLeft {
                0% { transform: scale(1) translate(0, 0) rotate(0deg); opacity: 1; }
                40% { transform: scale(1.15) translate(-16px, 6px) rotate(-18deg); opacity: 1; }
                100% { transform: scale(.72) translate(-46px, 32px) rotate(-42deg); opacity: 0; }
            }
            @keyframes coinSplitRight {
                0% { transform: scale(1) translate(0, 0) rotate(0deg); opacity: 1; }
                40% { transform: scale(1.15) translate(16px, 8px) rotate(20deg); opacity: 1; }
                100% { transform: scale(.72) translate(46px, 34px) rotate(45deg); opacity: 0; }
            }
            @keyframes coinCrackFlash {
                0% { transform: scale(.3); opacity: 1; filter: brightness(2.2); }
                50% { transform: scale(1.6); opacity: 1; }
                100% { transform: scale(2.4); opacity: 0; }
            }
            .coin-shatter-shard {
                position: absolute; left: 50%; top: 59%; width: 7px; height: 23px;
                margin: -12px 0 0 -3px; border-radius: 3px;
                background: linear-gradient(#fff,#fff6a3 38%,var(--coin-burst-color));
                box-shadow: 0 0 10px var(--coin-burst-color);
                animation: coinShatterShard .72s cubic-bezier(.12,.72,.24,1) var(--shard-delay,0ms) forwards;
            }
            @keyframes coinShatterRing {
                0% { opacity: .98; transform: scale(.18); }
                100% { opacity: 0; transform: scale(4.4); }
            }
            @keyframes coinShatterCore {
                0% { opacity: 0; transform: scale(.2) rotate(-35deg); }
                25% { opacity: 1; transform: scale(1.45) rotate(12deg); }
                55% { opacity: 1; transform: scale(.92) rotate(-6deg); }
                100% { opacity: 0; transform: scale(.3) rotate(35deg); }
            }
            @keyframes coinShatterShard {
                0% { opacity: 1; transform: rotate(var(--angle)) translateY(-10px) scale(.65); }
                100% { opacity: 0; transform: rotate(var(--angle)) translateY(calc(0px - var(--distance))) scale(.25); }
            }
            @keyframes coinShatterFlash {
                0% { opacity: .9; }
                100% { opacity: 0; }
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
            @keyframes energyStarScreenFlash {
                0% { opacity: 0; }
                16% { opacity: 1; }
                100% { opacity: 0; }
            }
            @keyframes energyPickupStar {
                0% { opacity: 0; transform: translate(-50%,-50%) scale(.12) rotate(-35deg); }
                26% { opacity: 1; transform: translate(-50%,-50%) scale(1.08) rotate(9deg); }
                52% { opacity: .96; transform: translate(-50%,-50%) scale(.9) rotate(-5deg); }
                100% { opacity: 0; transform: translate(-50%,-50%) scale(1.35) rotate(18deg); }
            }
            @keyframes energyPickupGlint {
                0% { opacity: 0; transform: translate(-50%,-50%) scale(.2) rotate(0deg); }
                32% { opacity: 1; transform: translate(-50%,-50%) scale(1.5) rotate(45deg); }
                100% { opacity: 0; transform: translate(-50%,-50%) scale(.2) rotate(115deg); }
            }
            @keyframes flashFade { 0% { opacity: 1; } 100% { opacity: 0; } }
            .subway-hud-alert {
                position: fixed; top: calc(env(safe-area-inset-top, 0px) + 64px); left: 50%; transform: translateX(-50%);
                z-index: 100000; background: rgba(16, 18, 22, 0.94); color: #f4f5f7;
                border: 1px solid rgba(255, 255, 255, 0.14); padding: 9px 18px;
                border-radius: 10px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
                font-weight: 600; font-size: 13px; letter-spacing: 0.2px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.45); pointer-events: none;
                max-width: calc(100vw - 32px); text-align: center; white-space: nowrap;
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
                background: rgba(14, 17, 23, 0.90);
                border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
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
                background: rgba(14, 17, 23, 0.88);
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
            .cd-circle-glow { display: none !important; }
            .countdown-num {
                font-size: 80px;
                font-weight: 800;
                font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
                color: #ffffff;
                background: linear-gradient(180deg, #ffffff 40%, #e2e8f0 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
                filter: drop-shadow(0 2px 10px rgba(255, 255, 255, 0.25));
                line-height: 1;
                margin: 0;
                letter-spacing: -2px;
                z-index: 1;
            }
            .countdown-num.pop {
                animation: cdMinimalPop 0.28s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .countdown-num.go {
                font-size: 64px;
                font-weight: 900;
                background: linear-gradient(180deg, #ffffff 30%, #34d399 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                filter: drop-shadow(0 4px 20px rgba(52, 211, 153, 0.4));
                letter-spacing: 2px;
                animation: cdMinimalPop 0.28s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes cdMinimalPop {
                0% { transform: scale(1.18); opacity: 0.6; }
                100% { transform: scale(1); opacity: 1; }
            }
            .countdown-sub {
                margin-top: 14px;
                padding: 4px 14px;
                border-radius: 9999px;
                background: rgba(15, 23, 42, 0.75);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: #94a3b8;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 1.8px;
                text-transform: uppercase;
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
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

            /* Responsive Mobile & Small-Screen Adaptation (Unified Obsidian UI) */
            @media (max-width: 768px) {
                * {
                    -webkit-tap-highlight-color: transparent !important;
                }
                .subway-modal-backdrop {
                    padding: 8px !important;
                    align-items: center !important;
                    justify-content: center !important;
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                    background: rgba(7, 9, 12, 0.88) !important;
                }
                .subway-modal-box, .unified-box {
                    width: 96vw !important;
                    max-width: 500px !important;
                    height: auto !important;
                    max-height: 90dvh !important;
                    margin: auto !important;
                    border-radius: 14px !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                    display: flex !important;
                    flex-direction: column !important;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85) !important;
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                    background: #101216 !important;
                }
                .modal-header {
                    padding: 12px 14px !important;
                    flex-shrink: 0 !important;
                    background: #14171d !important;
                }
                .modal-brand-title { font-size: 13px !important; }
                .btn-modal-close {
                    font-size: 20px !important;
                    min-width: 36px !important;
                    min-height: 36px !important;
                }

                .unified-tabs {
                    display: flex !important;
                    gap: 4px !important;
                    padding: 6px 10px !important;
                    flex-shrink: 0 !important;
                    background: #121419 !important;
                    overflow-x: auto !important;
                    scrollbar-width: none !important;
                }
                .unified-tabs::-webkit-scrollbar { display: none !important; }
                .tab-btn {
                    padding: 8px 10px !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    flex: 1 0 auto !important;
                    min-height: 36px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    border-radius: 7px !important;
                    border-bottom: none !important;
                    margin-bottom: 0 !important;
                    background: transparent !important;
                }
                .tab-btn.active {
                    background: #202531 !important;
                    color: #ffffff !important;
                    border: 1px solid rgba(255, 255, 255, 0.16) !important;
                }

                .tab-pane {
                    flex: 1 !important;
                    overflow-y: auto !important;
                    -webkit-overflow-scrolling: touch !important;
                    padding: 12px !important;
                    box-sizing: border-box !important;
                }
                .settings-grid-rows {
                    grid-template-columns: 1fr !important;
                    gap: 8px !important;
                }
                .sw-skins-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    gap: 8px !important;
                }
                input[type="range"] { height: 8px !important; }
                input[type="range"]::-webkit-slider-thumb { width: 22px !important; height: 22px !important; }
                input[type="text"], #input-my-nick, #input-my-avatar-url, .lobby-join-box input {
                    font-size: 16px !important;
                    min-height: 36px !important;
                }

                .btn-subway-unified-menu {
                    width: 42px !important;
                    height: 42px !important;
                    bottom: max(14px, env(safe-area-inset-bottom, 14px)) !important;
                    left: max(12px, env(safe-area-inset-left, 12px)) !important;
                }
                .btn-subway-online-lobby {
                    height: 36px !important;
                    padding: 0 11px !important;
                    top: max(12px, env(safe-area-inset-top, 12px)) !important;
                    left: max(56px, env(safe-area-inset-left, 56px)) !important;
                    font-size: 11px !important;
                }
                .subway-hud-alert {
                    top: calc(env(safe-area-inset-top, 0px) + 56px) !important;
                    font-size: 12px !important;
                    padding: 8px 14px !important;
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
                gap: 4px;
                margin-bottom: 10px;
                background: #101216;
                padding: 4px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .btn-mp-mode {
                flex: 1;
                padding: 8px 12px;
                background: transparent;
                border: 1px solid transparent;
                border-radius: 6px;
                color: #8b94a3;
                font-family: inherit;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.4px;
                cursor: pointer;
                touch-action: manipulation;
                transition: background 0.15s ease, color 0.15s ease;
            }
            .btn-mp-mode:hover {
                color: #f3f4f6;
                background: rgba(255, 255, 255, 0.04);
            }
            .btn-mp-mode:active {
                transform: scale(0.97);
            }
            .btn-mp-mode.active {
                background: #202531;
                color: #ffffff;
                border-color: rgba(255, 255, 255, 0.22);
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

            /* Mobile Lobby & Touch Overrides */
            @media (max-width: 680px) {
                .subway-modal-box, .unified-box {
                    width: 96vw !important;
                    max-width: 96vw !important;
                    max-height: 92dvh !important;
                    border-radius: 12px !important;
                }
                .lobby-grid {
                    display: grid !important;
                    grid-template-columns: 1fr !important;
                    gap: 10px !important;
                }
                .lobby-column {
                    width: 100% !important;
                }
                .lobby-header-bar {
                    grid-template-columns: 1fr !important;
                    gap: 8px !important;
                    padding: 10px !important;
                }
                .lobby-join-box {
                    width: 100% !important;
                    justify-self: stretch !important;
                }
                .lobby-join-box input {
                    flex: 1 !important;
                }
                #input-my-nick { width: 100px !important; }
                .party-slot {
                    height: 44px !important;
                    padding: 0 10px !important;
                }
                .btn-ready, .btn-start-match, .btn-leave-room {
                    min-height: 44px !important;
                    font-size: 12px !important;
                    touch-action: manipulation !important;
                }
                .online-players-list {
                    max-height: 160px !important;
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
    applyGraphicsSettings();

    // Reapply saved settings & expose full Total-Unlock Engine API (window.__SW__)
    window.__SW_UNLOCK_ALL__ = function(coinsAmount = 9999999, keysAmount = 9999) {
        try {
            const app = window.app;
            (window.__SW_CHARS_DATA__ || []).forEach(c => {
                if (!c) return;
                c.available = true;
                c.purchased = true;
                c.cost = 0;
                (c.outfits || []).forEach(o => { o.available = true; o.purchased = true; o.locked = false; o.cost = 0; });
            });
            (window.__SW_BOARDS_DATA__ || []).forEach(b => {
                if (!b) return;
                b.available = true;
                b.purchased = true;
                b.cost = 0;
                (b.powerups || []).forEach(p => { p.purchased = true; p.locked = false; p.cost = 0; });
            });
            if (app && app.user) {
                app.user.coins = Math.max(app.user.coins || 0, coinsAmount);
                app.user.keys = Math.max(app.user.keys || 0, keysAmount);
                app.user.hoverboards = Math.max(app.user.hoverboards || 0, 999);
                if (app.user.boosts && app.user.boosts.permanents) {
                    Object.keys(app.user.boosts.permanents).forEach(k => { app.user.boosts.permanents[k] = 5; });
                }
                if (app.user.shopSettings && app.user.shopSettings.purchased) {
                    app.user.shopSettings.purchased.characters = (window.__SW_CHARS_DATA__ || []).map(c => c.id);
                    app.user.shopSettings.purchased.boards = (window.__SW_BOARDS_DATA__ || []).map(b => b.id);
                }
                app.user.save && app.user.save();
            }
            return true;
        } catch(e) { return false; }
    };

    window.__SW__ = {
        get app() { return window.app || window.__SW_APP__; },
        get game() { return window.game || (window.app && window.app.game); },
        get hero() { return (this.game && this.game.hero) || null; },
        get scene() { return (this.game && this.game.scene) || (this.app && this.app.scene) || null; },
        get physics() { return (this.game && this.game.physics) || null; },
        get camera() { return (this.game && this.game.camera) || null; },
        get controller() { return (this.game && this.game.controller) || null; },
        get stats() { return (this.game && this.game.stats) || null; },
        get user() { return (this.app && this.app.user) || null; },
        get library() { return window.__lib || (this.app && this.app.library) || null; },
        get config() { return window.__SW_CONFIG__ || null; },
        get classes() { return window.__SW_CLASSES__ || {}; },
        get modules() { return window.__SW_MODULES__ || null; },
        get cache() { return window.__SW_CACHE__ || null; },
        get require() { return window.__SW_REQUIRE__ || null; },
        get lights() { return window.__SW_LIGHT_SYSTEMS__ || []; },
        get chars() { return window.__SW_CHARS_DATA__ || []; },
        get boards() { return window.__SW_BOARDS_DATA__ || []; },
        get tuning() { return window.__SW_TUNING__; },
        gfx: GFX_SETTINGS,
        unlockAll: window.__SW_UNLOCK_ALL__,
        getSkins: getSkinCatalog,
        selectSkin: (charId, outfit = 0) => {
            const list = getSkinCatalog();
            const found = list.find(s => s.charId === charId && s.outfit === outfit) || list.find(s => s.charId === charId);
            if (found) return applySkinSelection(found, false);
        },
        setShader: mode => {
            if (!['off', 'medium'].includes(mode)) return;
            GFX_SETTINGS.shaders = mode;
            localStorage.setItem('sw_shaders', mode);
            applyGraphicsSettings();
        },
        setFPS: fpsVal => {
            const clamped = String(Math.min(240, parseInt(fpsVal, 10) || 240));
            GFX_SETTINGS.fps = clamped;
            localStorage.setItem('sw_fps', GFX_SETTINGS.fps);
            applyGraphicsSettings();
        },
        setHalfWagonChance: prob => {
            window.__SW_TUNING__.halfWagonChance = Math.max(0, Math.min(1, Number(prob) || 0));
        }
    };

    let _lastSurfaceGame = null;
    let _lastSurfaceCanvas = null;
    let _lastSurfaceSoundVolApplied = false;
    function reapplyPersistedGraphicsToSurface(force) {
        const curGame = window.game || null;
        const canvas = document.querySelector('#game-canvas') || (window.app && window.app.view) || document.querySelector('canvas');
        if (window.app && window.app.sound && !_lastSurfaceSoundVolApplied) {
            _lastSurfaceSoundVolApplied = true;
            applyGameVolume(GFX_SETTINGS.volume);
        }
        if (!force && curGame === _lastSurfaceGame && canvas === _lastSurfaceCanvas) return;
        _lastSurfaceGame = curGame;
        _lastSurfaceCanvas = canvas;
        if (canvas) {
            applyCanvasGraphicsFilter(canvas, GFX_SETTINGS.saturation);
        }
        applyShaderAndShadowPipeline();
        applyGameVolume(GFX_SETTINGS.volume);
        optimizeHeroAnimAndFluidity();
        initMotionBlurEngine();
        const targetMaxFPS = Math.min(240, parseInt(GFX_SETTINGS.fps, 10) || 240);
        applyTickerMaxFPS(targetMaxFPS);
        updateSkinHubVisibility();
    }
    window.addEventListener('pageshow', () => reapplyPersistedGraphicsToSurface(true));
    setInterval(() => reapplyPersistedGraphicsToSurface(false), 1200);
})();




