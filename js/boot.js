/* eslint-disable func-names */
/* eslint-disable no-var */
/** Load script file */
function loadScript(path, onComplete, onError)
{
    var script = document.createElement('script');

    if (onComplete) script.onload = onComplete;
    if (onError) script.onerror = onError;
    script.src = path;
    document.head.appendChild(script);
}

function showStartupError(label)
{
    var message = document.getElementById('message');
    if (!message) return;
    message.innerHTML = '<div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90vw;padding:22px 26px;border-radius:14px;background:#101827;color:#fff;font:600 16px Arial;text-align:center;box-shadow:0 12px 40px #0008"><strong style="color:#ff8a65">Não foi possível iniciar o jogo</strong><br><span style="display:block;margin-top:10px;font-size:13px;color:#cbd5e1">Falha ao carregar ' + label + '. Atualize a página e tente novamente.</span></div>';
}

/** Start up Poki SDK */
function initPokiSDK(onComplete)
{
    var PokiSDK = window.PokiSDK;

    // No PokiSDK available, move on.
    if (!PokiSDK) return onComplete();

    // Promise callback, should be dispatched either way
    function onInitComplete(adBlockerOn)
    {
        PokiSDK.adBlockerOn = adBlockerOn;
        PokiSDK.gameLoadingStart();
        if (onComplete) onComplete();
    }

    // Init the SDK and notify about loading start
    return PokiSDK.init()
        .then(function ()
        {
            onInitComplete(false);
        })
        .catch(function ()
        {
            onInitComplete(true);
        });
}

/** Init app */
function initApp()
{
    // Set SDK debug mode
    if (window.PokiSDK && window.GAME_CONFIG && window.GAME_CONFIG.pokiSdkDebug !== undefined)
    {
        window.PokiSDK.setDebug(window.GAME_CONFIG.pokiSdkDebug);
    }

    // index.js reads the engine's webpack modules as soon as it executes.
    // Sequence the scripts to prevent the startup race that leaves only the blue page background.
    loadScript('./js/dependencies.bundle.js?v=65', function ()
    {
        loadScript(window.MAIN ? window.MAIN : './js/index.js?v=50', null, function ()
        {
            showStartupError('o código principal do jogo');
        });
    }, function ()
    {
        showStartupError('as dependências do motor 3D');
    });
}

/** Prevent arrows and space from scrolling browser */
function preventDefaultKeyboardEvents()
{
    const keys = [
        ' ',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
    ];

    function onKey(e)
    {
        if (keys.indexOf(e.key) < 0) return;
        e.preventDefault();
    }

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
}

function registerServiceWorker(onComplete)
{
    if (navigator.serviceWorker && !window.NOSW)
    {
        console.log('Service worker available');
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(function ()
            {
                console.log('Service worker registered');
                if (onComplete) onComplete();
            })
            .catch(function (error)
            {
                // eslint-disable-next-line prefer-template
                console.log('Service worker registration failed - ' + error);
                if (onComplete) onComplete();
            });
    }
    else if (onComplete)
    {
        onComplete();
    }
}

/** Prevent default keyboard events */
preventDefaultKeyboardEvents();

/** Register service worker if available */
registerServiceWorker(function ()
{
    initPokiSDK(function ()
    {
        initApp();
    });
});

