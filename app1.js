/* =========================================================================
   ELECTRO-GRÚA // INTERFAZ DE CONTROL INDUSTRIAL
   ========================================================================= */

/* -------------------------------------------------------------------------
   SONIDOS
------------------------------------------------------------------------- */
const Sound = (() => {

    let ctx = null;
    let muted = false;

    let humOsc = null;
    let humGain = null;
    let humLFO = null;
    let humLFOGain = null;

    function ensure() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return ctx;
    }

    function tone({
        freq = 440,
        dur = .18,
        type = 'sine',
        gain = .05,
        sweep = null,
        delay = 0
    }) {
        if (muted) return;

        const ac = ensure();
        const t0 = ac.currentTime + delay;

        const osc = ac.createOscillator();
        const g = ac.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);

        if (sweep)
            osc.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);

        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);

        osc.connect(g);
        g.connect(ac.destination);

        osc.start(t0);
        osc.stop(t0 + dur + .02);
    }

    //==================================================
    // ZUMBIDO CONTINUO DEL TRANSFORMADOR
    //==================================================

    //==================================================
    // ZUMBIDO CONTINUO DEL TRANSFORMADOR
    //==================================================

    let humShouldPlay = false; // true si el sistema requiere el zumbido, independientemente del mute

    function startHumNodes() {
        const ac = ensure();

        if (humOsc) return;

        // Oscilador principal (onda diente de sierra para ese sonido "sucio" y eléctrico de 60Hz)
        humOsc = ac.createOscillator();
        humOsc.type = "sawtooth";
        humOsc.frequency.value = 60;

        // Volumen del zumbido
        humGain = ac.createGain();
        humGain.gain.value = 0.025;

        // Modulador LFO para simular la vibración y oscilación real de la corriente alterna
        humLFO = ac.createOscillator();
        humLFO.type = "sine";
        humLFO.frequency.value = 1.8;

        humLFOGain = ac.createGain();
        humLFOGain.gain.value = 1.2;

        humLFO.connect(humLFOGain);
        humLFOGain.connect(humOsc.frequency);

        humOsc.connect(humGain);
        humGain.connect(ac.destination);

        humOsc.start();
        humLFO.start();
    }

    function startHum() {
        humShouldPlay = true;
        if (muted) return; // se recuerda para cuando se desmutee, pero no suena ahora
        startHumNodes();
    }

    function stopHumNodes() {

        if (!humOsc) return;

        // Transición de apagado suave para evitar "clicks" de audio abruptos
        humGain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + 0.12
        );

        setTimeout(() => {
            if (!humOsc) return; // Validación por seguridad cooperativa

            humOsc.stop();
            humLFO.stop();

            humOsc.disconnect();
            humGain.disconnect();
            humLFO.disconnect();
            humLFOGain.disconnect();

            humOsc = null;
            humGain = null;
            humLFO = null;
            humLFOGain = null;

        }, 130);
    }

    function stopHum() {
        humShouldPlay = false;
        stopHumNodes();
    }

    function setMuted(value) {
        muted = value;
        if (muted) {
            stopHumNodes(); // silencia el zumbido activo sin olvidar que debía sonar
        } else if (humShouldPlay) {
            startHumNodes(); // reanuda el zumbido si el sistema lo requería
        }
        return muted;
    }

    return {

        click() {
            tone({ freq: 1200, dur: .05, type: 'square', gain: .03 });
        },

        power_on() {
            tone({ freq: 120, dur: .5, type: 'sawtooth', gain: .05, sweep: 640 });
            tone({ freq: 1800, dur: .35, type: 'sine', gain: .02, delay: .08 });
        },

        power_off() {
            tone({ freq: 640, dur: .4, type: 'sawtooth', gain: .05, sweep: 80 });
        },

        motor() {
            tone({ freq: 220, dur: .25, type: 'triangle', gain: .035, sweep: 280 });
        },

        magnet() {
            tone({ freq: 340, dur: .3, type: 'sine', gain: .04, sweep: 900 });
            tone({ freq: 60, dur: .4, type: 'sine', gain: .04, delay: .02 });
        },

        alarm() {
            tone({ freq: 880, dur: .15, type: 'square', gain: .045 });
            tone({ freq: 660, dur: .15, type: 'square', gain: .045, delay: .18 });
        },

        startHum,
        stopHum,

        toggleMute() {
            return setMuted(!muted);
        },
        isMuted() {
            return muted;
        }

    };

})();

/* -------------------------------------------------------------------------
   1. BACKGROUND FX — hex grid + drifting particles (canvas)
------------------------------------------------------------------------- */
(function backgroundFX(){
  const hexCanvas = document.getElementById('bg-hex');
  const parCanvas = document.getElementById('bg-particles');
  const hctx = hexCanvas.getContext('2d');
  const pctx = parCanvas.getContext('2d');
  let w,h;
  function size(){
    w = window.innerWidth; h = window.innerHeight;
    if(hexCanvas && parCanvas){
      [hexCanvas,parCanvas].forEach(c=>{ c.width=w; c.height=h; });
    }
  }
  size(); window.addEventListener('resize', size);

  function drawHex(){
    if(!hexCanvas) return;
    hctx.clearRect(0,0,w,h);
    const r = 26, dx = r*1.75, dy = r*1.52;
    hctx.strokeStyle = 'rgba(0,229,255,0.10)'; hctx.lineWidth = 1;
    let row=0;
    for(let y=-r*2; y<h+r*2; y+=dy){
      const offset = (row%2)*dx/2;
      for(let x=-r*2; x<w+r*2; x+=dx){
        hexPath(hctx, x+offset, y, r); hctx.stroke();
      }
      row++;
    }
  }
  function hexPath(ctx,cx,cy,r){
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a = Math.PI/180*(60*i-30);
      const px = cx+r*Math.cos(a), py = cy+r*Math.sin(a);
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.closePath();
  }
  drawHex();
  window.addEventListener('resize', ()=>setTimeout(drawHex,50));

  const particles = Array.from({length:70}, ()=>({
    x: Math.random()*w, y: Math.random()*h,
    vx: (Math.random()-.5)*.15, vy: -.08-Math.random()*.22,
    r: Math.random()*1.6+.3, a: Math.random()*.5+.15
  }));
  function tickParticles(){
    if(!parCanvas) return;
    pctx.clearRect(0,0,w,h);
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.y<-10){ p.y=h+10; p.x=Math.random()*w; }
      if(p.x<-10) p.x=w+10; if(p.x>w+10) p.x=-10;
      pctx.beginPath();
      pctx.fillStyle = `rgba(0,229,255,${p.a})`;
      pctx.arc(p.x,p.y,p.r,0,Math.PI*2); pctx.fill();
    });
    requestAnimationFrame(tickParticles);
  }
  tickParticles();
})();

/* -------------------------------------------------------------------------
   2. BOOT SEQUENCE
------------------------------------------------------------------------- */
(function boot(){
  const lines = [
    '> INICIALIZANDO NÚCLEO DE CONTROL...',
    '> CARGANDO DIAGNÓSTICO DE MOTORES...',
    '> VERIFICANDO INTEGRIDAD ESTRUCTURAL...',
    '> CALIBRANDO ELECTROIMÁN PRINCIPAL...',
    '> SISTEMA LISTO.'
  ];
  const el = document.getElementById('boot-lines');
  if(el){
    lines.forEach(l=>{ const s=document.createElement('span'); s.textContent=l; el.appendChild(s); });
  }

  const tl = gsap.timeline({delay:.3});
  tl.to('#hero-content',{opacity:1,duration:.4});
  tl.to('.pulse-ring',{opacity:.5,scale:1.15,duration:1.2,ease:'power1.out',stagger:.3},'-=.2');
  tl.to('.pulse-ring',{opacity:0,duration:1},'-=.4');
  if(el){
    el.querySelectorAll('span').forEach((s,i)=>{
      tl.to(s,{opacity:1,duration:.15,onStart:()=>Sound.click()}, i*0.38+0.2);
    });
  }
  tl.to('#boot-btn',{opacity:1,duration:.5},'+=.2');

  const bootBtn = document.getElementById('boot-btn');
  if(bootBtn){
    bootBtn.addEventListener('click', ()=>{
      Sound.click();
      const target = document.getElementById('info-inicio');
      if(target) target.scrollIntoView({behavior:'smooth'});
    });
  }

  // Arranque del simulador: se activa desde el panel de bloqueo al final de la página
  const simStartBtn = document.getElementById('sim-start-btn');
  if(simStartBtn){
    simStartBtn.addEventListener('click', ()=>{
      Sound.power_on();
      const overlay = document.getElementById('sim-lock-overlay');
      const shell = document.getElementById('app');
      if(shell) shell.classList.remove('locked');
      if(overlay){
        gsap.to(overlay,{opacity:0,duration:.5,onComplete:()=>{ overlay.style.display='none'; }});
      }
      App.init();
    }, { once:true });
  }
})();

/* -------------------------------------------------------------------------
   3. GLOBAL APP STATE + ORCHESTRATION & COMMUNICATIONS
------------------------------------------------------------------------- */
const App = (() => {
  const state = {
    power:false, magnet:false,
    motors:{giro:false, brazo:false, elevacion:false},
    armExtend:0,
    hookHeight:0,
    towerAngle:0,
    exploded:false,
    current:0, voltage:0
  };

  let charts = {}; // Contenedor para referencias de Chart.js

  /* ---------------------------------------------------------------------
     MODELO FÍSICO REAL
     Basado en los datos reales aportados por el usuario:
       - Bobina primaria del transformador de horno microondas (MOT): 600 vueltas
       - Electroimán alimentado con corriente alterna de 120V / 60Hz
       - Motores de corriente directa de 12V (batería de auto)

     La geometría del núcleo, la resistencia real del devanado y las
     características exactas de los motores NO fueron proporcionadas,
     así que se usan valores de referencia típicos para un MOT/motor DC
     pequeño. Esos quedan marcados como "ASUMIDO" — ajústalos si mides
     tus componentes reales (resistencia con multímetro, dimensiones del
     núcleo, corriente de arranque del motor, etc.) para mayor precisión.
  --------------------------------------------------------------------- */
  const PHYS = {
    MU0: 4 * Math.PI * 1e-7,   // permeabilidad del vacío (T·m/A)

    // --- Electroimán (DATO REAL: 600 vueltas, 120V AC) ---
    AC_V: 120,                 // V rms — dato real
    AC_F: 60,                  // Hz — red eléctrica estándar
    N_COIL: 600,                // vueltas — dato real
    CORE_LEN: 0.19,             // m — ASUMIDO: long. media del núcleo (típico MOT)
    CORE_AREA: 0.0011,          // m² — ASUMIDO: sección del núcleo (~11 cm², típico MOT)
    MU_R: 1500,                 // ASUMIDO: permeabilidad relativa del acero al silicio
    B_SAT: 1.6,                 // T — ASUMIDO: inducción de saturación típica del núcleo
    COIL_R: 3.2,                 // Ω — ASUMIDO: resistencia del devanado de 600 vueltas

    // --- Motores (DATO REAL: 12V DC, batería de auto) ---
    DC_V: 12,                   // V — dato real
    MOTOR_R: 0.8,                // Ω — ASUMIDO: resistencia de armadura
    MOTOR_NO_LOAD_RPM: 3000,     // RPM — ASUMIDO: velocidad libre del motor (en el eje)
    GEAR_RATIO: 30                // ASUMIDO: reducción motor → mecanismo de la grúa
  };

  // Electroimán: circuito RL real alimentado por 120V/60Hz con N=600 vueltas
  function computeElectromagnet() {
    const { MU0, AC_V, AC_F, N_COIL, CORE_LEN, CORE_AREA, MU_R, B_SAT, COIL_R } = PHYS;

    const L = MU0 * MU_R * N_COIL * N_COIL * CORE_AREA / CORE_LEN; // H — Ley de Hopkinson
    const omega = 2 * Math.PI * AC_F;
    const XL = omega * L;                                    // Ω — reactancia inductiva
    const Z = Math.sqrt(COIL_R * COIL_R + XL * XL);          // Ω — impedancia total
    const I_rms = AC_V / Z;                                   // A — corriente real (Ohm en AC)
    const I_peak = I_rms * Math.SQRT2;

    let B = MU0 * MU_R * N_COIL * I_peak / CORE_LEN;         // T — Ley de Ampère (núcleo)
    const saturated = B > B_SAT;
    if (saturated) B = B_SAT;

    const F = (B * B * CORE_AREA) / (2 * MU0);               // N — fuerza (tensor de Maxwell)
    const P = I_rms * I_rms * COIL_R;                         // W — calor Joule real (I²R)

    return { L, XL, Z, I_rms, I_peak, B, saturated, F, P };
  }

  // Motores DC 12V: modelo de fuerza contraelectromotriz (Ley de Faraday aplicada al motor)
  function computeMotor(active) {
    const { DC_V, MOTOR_R, MOTOR_NO_LOAD_RPM, GEAR_RATIO } = PHYS;
    if (!active) return { rpm: 0, current: 0, voltage: 0, power: 0, backEmf: 0 };

    const Kv = MOTOR_NO_LOAD_RPM / DC_V;  // RPM por voltio
    const Ke = 1 / Kv;                     // V por RPM (cte. de fuerza contraelectromotriz)

    // Bajo carga típica de operación (~70% de la velocidad libre)
    const outputRpm = (MOTOR_NO_LOAD_RPM / GEAR_RATIO) * 0.7;
    const motorRpm = outputRpm * GEAR_RATIO;
    const backEmf = Ke * motorRpm;                    // V — Ley de Faraday (fcem)
    const current = Math.max(0, (DC_V - backEmf) / MOTOR_R); // A — Ley de Ohm con fcem
    const power = DC_V * current;                      // W

    return { rpm: Math.round(outputRpm), current, voltage: DC_V, power, backEmf };
  }

  function sendIframeCommand(action, value = null) {
    const iframe = document.getElementById('simulation-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ action, value }, '*');
    } else {
      window.postMessage({ action, value }, '*');
    }
  }

  function log(msg){
    const c = document.getElementById('emis-console');
    if (!c) return;
    const l = document.createElement('div');
    l.className='line'; l.textContent = msg;
    c.appendChild(l);
    gsap.to(l,{opacity:1,duration:.3});
    c.scrollTop = c.scrollHeight;
    while(c.children.length>40) c.removeChild(c.firstChild);
  }

  function setDot(id,on,err){
    const d = document.getElementById(id);
    if (!d) return;
    d.classList.toggle('on', !!on && !err);
    d.classList.toggle('err', !!err);
  }

  function togglePower(){
    state.power = !state.power;
    const btn = document.getElementById('power-toggle');
    btn.textContent = state.power ? 'APAGAR' : 'ENCENDER';
    btn.classList.toggle('off', !state.power);
    setDot('dot-power', state.power);

    const fsPower = document.getElementById('fs-power-btn');
    if(fsPower){
      fsPower.textContent = state.power ? 'APAGAR' : 'ENCENDER';
      fsPower.classList.toggle('on', state.power);
    }
    
    sendIframeCommand('setPower', state.power);

    if(state.power){
      Sound.power_on(); 
      log('Sistema iniciado.');
      animateChartsOnPower();
    } else {
      Sound.power_off(); 
      Sound.stopHum(); // <--- CORRECCIÓN: Apaga el zumbido del electroimán inmediatamente al quitar la corriente global
      log('Sistema apagado.');
      state.motors.giro=state.motors.brazo=state.motors.elevacion=false;
      if(state.magnet){ 
        state.magnet=false; 
        syncButtons(['magnet-btn','fs-magnet-btn'], 'active', false);
        log('Electroimán desactivado.'); 
      }
      setDot('dot-motors',false); setDot('dot-magnet',false);
      renderMotorCards();
      resetCharts();
    }
  }

  function motorPulse(name, label, direction = 1){
    if(!state.power){ 
      Sound.alarm(); 
      setDot('dot-power',false,true); 
      setTimeout(()=>setDot('dot-power',false),400); 
      log('Encienda el sistema antes de operar los motores.'); 
      return false; 
    }
    state.motors[name]=true;
    setDot('dot-motors', true);
    Sound.motor();
    renderMotorCards();
    log(label+' en operación.');

    sendIframeCommand('moveMotor', { motor: name, direction: direction });
    
    // Al actuar el motor, recalculamos telemetrías físicas en tiempo real
    animateChartsOnPower();

    clearTimeout(state.motors['_t'+name]);
    state.motors['_t'+name] = setTimeout(()=>{ 
      state.motors[name]=false; 
      renderMotorCards();
      if(!state.motors.giro && !state.motors.brazo && !state.motors.elevacion) {
        setDot('dot-motors', state.power);
      }
      sendIframeCommand('stopMotor', { motor: name });
    }, 900);
    return true;
  }

  function toggleMagnet(){

      if(!state.power){
          Sound.alarm();
          log('Active el sistema para usar el electroimán.');
          return;
      }

      state.magnet = !state.magnet;

      syncButtons(['magnet-btn','fs-magnet-btn'], 'active', state.magnet);

      setDot('dot-magnet', state.magnet);

      if(state.magnet){
          Sound.magnet();      // Transición sonora inicial de encendido
          Sound.startHum();    // <--- ACTIVA el zumbido continuo del transformador de 60Hz
      }else{
          Sound.stopHum();     // <--- APAGA el zumbido continuo del transformador
      }

      sendIframeCommand('setMagnet', state.magnet);

      log(
          state.magnet
          ? 'Campo magnético estable. Objeto metálico detectado.'
          : 'Electroimán desactivado. Carga liberada.'
      );

      animateChartsOnPower();
  }

  function toggleExploded(){
    if(!state.power){ 
      Sound.alarm(); 
      log('Active el sistema para acceder a la vista explosionada.'); 
      return; 
    }
    state.exploded = !state.exploded;
    syncButtons(['exploded-btn','fs-exploded-btn'], 'active', state.exploded);

    sendIframeCommand('setExploded', state.exploded);
    log(state.exploded ? 'Desensamblando piezas estructurales: Vista explosionada activada.' : 'Ensamblando componentes: Vista normal restablecida.');
  }

  const motorDefs = [
    {id:'giro', name:'Motor de Giro', act:'left/right'},
    {id:'brazo', name:'Motor del Brazo', act:'extend/retract'},
    {id:'elevacion', name:'Motor de Elevación', act:'up/down'},
    {id:'electroiman', name:'Electroimán', act:'magnet'}
  ];

  function renderMotorCards(){
    const host = document.getElementById('motor-cards');
    if(!host) return;
    host.innerHTML='';
    const em = computeElectromagnet(); // recalcula el circuito real del electroimán (120V/60Hz, N=600)

    motorDefs.forEach(m=>{
      const active = m.id==='electroiman' ? state.magnet : state.motors[m.id];
      let rpm, amp, volt, temp;

      if (m.id === 'electroiman') {
        // El electroimán no gira: no tiene RPM. Corriente/voltaje reales del circuito AC.
        rpm = 0;
        const iReal = state.power ? (state.magnet ? em.I_rms : em.I_rms * 0.02) : 0; // corriente magnetizante residual sin excitar
        amp = iReal.toFixed(2);
        volt = state.power ? PHYS.AC_V.toFixed(0) : 0;
        // Temperatura: base ambiente + aporte de calor Joule real (I²R)
        temp = state.power ? (24 + (state.magnet ? em.P * 3 : 0.3)).toFixed(0) : 20;
      } else {
        const mo = computeMotor(active);
        rpm = mo.rpm;
        amp = active ? mo.current.toFixed(1) : (state.power ? 0.1 : 0).toFixed(1);
        volt = state.power ? PHYS.DC_V.toFixed(1) : 0;
        temp = active ? (25 + mo.power * 0.55).toFixed(0) : (state.power ? 24 : 20);
      }

      const el = document.createElement('div');
      el.className='motor-card';
      el.innerHTML = `
        <div class="motor-head">
          <div class="motor-name">${m.name}</div>
          <div class="motor-state ${active?'on':''}">${active?'ACTIVO':'STANDBY'}</div>
        </div>
        <div class="motor-grid">
          <div><span></span><b>${rpm} RPM</b></div>
          <div><span></span><b>${amp} A</b></div>
          <div><span></span><b>${volt} V</b></div>
          <div><span></span><b>${temp}°C</b></div>
        </div>
        <div class="led-row">
          <div class="led ${active?'on-active':''}">ON</div>
          <div class="led ${!active?'off-active':''}">OFF</div>
        </div>`;
      host.appendChild(el);
    });
  }

  function bindMovementButtons(){
    document.querySelectorAll('.ctrl-btn[data-act], .fs-ctrl-btn[data-act]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const act = btn.dataset.act;
        if(!act) return;
        Sound.click();
        if(act==='left'){ motorPulse('giro','Motor de giro', -1); }
        if(act==='right'){ motorPulse('giro','Motor de giro', 1); }
        if(act==='up'){ motorPulse('elevacion','Motor de elevación', 1); }
        if(act==='down'){ motorPulse('elevacion','Motor de elevación', -1); }
        if(act==='extend'){ motorPulse('brazo','Motor del brazo', 1); }
        if(act==='retract'){ motorPulse('brazo','Motor del brazo', -1); }
      });
    });
  }

  /* Sincroniza una clase (active/on) entre el botón normal y su gemelo de pantalla completa */
  function syncButtons(ids, cls, on){
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.classList.toggle(cls, on);
    });
  }

  function bindFullscreenExtras(){
    const fsMagnet = document.getElementById('fs-magnet-btn');
    const fsExploded = document.getElementById('fs-exploded-btn');
    const fsPower = document.getElementById('fs-power-btn');
    if(fsMagnet) fsMagnet.addEventListener('click', ()=>{ Sound.click(); toggleMagnet(); });
    if(fsExploded) fsExploded.addEventListener('click', ()=>{ Sound.click(); toggleExploded(); });
    if(fsPower) fsPower.addEventListener('click', ()=>{ Sound.click(); togglePower(); });
  }

  function bindMuteButton(){
    const btn = document.getElementById('btn-mute');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      const isMuted = Sound.toggleMute();
      btn.classList.toggle('muted', isMuted);
      btn.title = isMuted ? 'Activar Sonido' : 'Silenciar Sonido';
      if(!isMuted) Sound.click(); // pequeño feedback audible al reactivar el sonido
    });
  }

  function initFullscreen() {
    const btn = document.getElementById('btn-fullscreen');
    const container = document.getElementById('iframe-viewport-panel');
    if (!btn || !container) return;

    // Métodos reales con prefijos (Android viejo / Safari de escritorio)
    const requestFS = container.requestFullscreen || container.webkitRequestFullscreen ||
                       container.mozRequestFullScreen || container.msRequestFullscreen;
    const exitFS = document.exitFullscreen || document.webkitExitFullscreen ||
                   document.mozCancelFullScreen || document.msExitFullscreen;
    const getFSElement = () => document.fullscreenElement || document.webkitFullscreenElement ||
                                 document.mozFullScreenElement || document.msFullscreenElement;

    // iPhone/iPad en Safari (versiones antiguas) no exponen requestFullscreen para
    // elementos normales (solo para <video>), así que usamos un modo simulado con CSS.
    const nativeSupported = !!requestFS;

    function enterPseudoFullscreen() {
      container.classList.add('pseudo-fullscreen');
      document.body.classList.add('pseudo-fs-lock');
      btn.classList.add('active');
    }

    function exitPseudoFullscreen() {
      container.classList.remove('pseudo-fullscreen');
      document.body.classList.remove('pseudo-fs-lock');
      btn.classList.remove('active');
    }

    btn.addEventListener('click', () => {
      Sound.click();

      if (nativeSupported) {
        if (!getFSElement()) {
          requestFS.call(container).catch(err => {
            log(`Error al intentar entrar en pantalla completa: ${err.message}. Usando modo alterno.`);
            enterPseudoFullscreen(); // si falla igual, recurrimos al modo CSS
          });
        } else if (exitFS) {
          exitFS.call(document);
        }
      } else {
        // Sin API nativa (típico en iPhone/Safari): alternamos el modo simulado
        container.classList.contains('pseudo-fullscreen') ? exitPseudoFullscreen() : enterPseudoFullscreen();
      }
    });

    // Mantiene sincronizado el ícono/estado del botón en modo nativo
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
      document.addEventListener(evt, () => {
        btn.classList.toggle('active', !!getFSElement());
      });
    });

    // Permite salir del modo simulado con la tecla Escape (teclados externos en tablet, etc.)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && container.classList.contains('pseudo-fullscreen')) {
        exitPseudoFullscreen();
      }
    });
  }

  const baseOpts = (yTitle)=>({
    responsive:true, maintainAspectRatio:false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins:{ legend:{display:false} },
    scales:{
      x:{ grid:{color:'rgba(255,255,255,.03)'}, ticks:{color:'#8fa3b3', font:{family:'Share Tech Mono'}} },
      y:{ grid:{color:'rgba(255,255,255,.03)'}, ticks:{color:'#8fa3b3', font:{family:'Share Tech Mono'}}, title:{display:!!yTitle, text:yTitle, color:'#8fa3b3'} }
    }
  });

  /* Inicialización de las Telemetrías Físicas Reales */
  function initCharts(){
    const labels = ['T1','T2','T3','T4','T5','T6','T7'];
    
    // 1. LEY DE AMPÈRE: Campo B (micro Teslas)
    const ampereEl = document.getElementById('chart-ampere');
    if(ampereEl) {
      charts.ampere = new Chart(ampereEl, {
        type:'line',
        data:{labels, datasets:[{label:'B (mT)', data:[0,0,0,0,0,0,0],
          borderColor:'#00e6f6', backgroundColor:'rgba(0,230,246,.1)', tension:.4, fill:true}]},
        options: baseOpts('mT')
      });
    }

    // 2. EQUILIBRIO DE FUERZAS: Fuerza Magnética (N)
    const newtonEl = document.getElementById('chart-newton-maxwell');
    if(newtonEl) {
      charts.newton = new Chart(newtonEl, {
        type:'bar',
        data:{labels, datasets:[{label:'Fm (N)', data:[0,0,0,0,0,0,0],
          backgroundColor:'rgba(47,124,255,.55)', borderColor:'#2f7cff', borderWidth:1}]},
        options: baseOpts('N')
      });
    }

    // 3. EFECTO JOULE: Calor Disipado / Potencia (W)
    const jouleEl = document.getElementById('chart-joule');
    if(jouleEl) {
      charts.joule = new Chart(jouleEl, {
        type:'line',
        data:{labels, datasets:[{label:'P (W)', data:[0,0,0,0,0,0,0],
          borderColor:'#ff3b4e', backgroundColor:'rgba(255,59,78,.1)', tension:.4, fill:true}]},
        options: baseOpts('W')
      });
    }

    // 4. LEY DE FARADAY: Fuerza Electromotriz Inducida (V)
    const faradayEl = document.getElementById('chart-faraday');
    if(faradayEl) {
      charts.faraday = new Chart(faradayEl, {
        type:'line',
        data:{labels, datasets:[{label:'FEM (V)', data:[0,0,0,0,0,0,0],
          borderColor:'#00ffa2', backgroundColor:'rgba(0,255,162,.1)', tension:.4, fill:true}]},
        options: baseOpts('V')
      });
    }
  }

  function animateChartsOnPower() {
    if (!state.power) return;

    const em = computeElectromagnet(); // circuito real: 120V/60Hz, N=600 vueltas
    const motorActive = state.motors.giro || state.motors.brazo || state.motors.elevacion;

    // 1. LEY DE AMPÈRE: campo B real del núcleo (T → mT). Sin excitar, solo magnetismo residual.
    const B_mT = state.magnet ? em.B * 1000 : em.B * 1000 * 0.05;

    // 2. FUERZA DE MAXWELL: F = B²·A / (2·µ0), real, solo existe si el imán está activo
    const F_N = state.magnet ? em.F : 0;

    // 3. EFECTO JOULE: potencia real disipada = I²R del electroimán + V·I de los motores activos
    let motorPowerTotal = 0;
    ['giro', 'brazo', 'elevacion'].forEach(id => {
      if (state.motors[id]) motorPowerTotal += computeMotor(true).power;
    });
    const P_W = (state.magnet ? em.P : 0) + motorPowerTotal;

    // 4. LEY DE FARADAY: fcem real inducida en el motor en marcha (Ke · RPM)
    const motorSample = computeMotor(motorActive);
    const FEM_V = motorSample.backEmf;

    // Ruido de sensor (variación de instrumento real), NO aleatoriedad del valor físico en sí
    const withNoise = (base, pct) => +(base * (1 + (Math.random() - 0.5) * pct)).toFixed(2);

    if (charts.ampere) {
      charts.ampere.data.datasets[0].data = Array.from({length:7}, () => withNoise(B_mT, 0.05));
      charts.ampere.update();
    }
    if (charts.newton) {
      charts.newton.data.datasets[0].data = Array.from({length:7}, () => withNoise(F_N, 0.06));
      charts.newton.update();
    }
    if (charts.joule) {
      charts.joule.data.datasets[0].data = Array.from({length:7}, () => withNoise(P_W, 0.08));
      charts.joule.update();
    }
    if (charts.faraday) {
      charts.faraday.data.datasets[0].data = Array.from({length:7}, () => withNoise(FEM_V, 0.1));
      charts.faraday.update();
    }
  }

  function resetCharts() {
    Object.keys(charts).forEach(key => {
      charts[key].data.datasets[0].data = [0,0,0,0,0,0,0];
      charts[key].update();
    });
  }

  function init(){
    renderMotorCards();
    bindMovementButtons();
    bindFullscreenExtras();
    bindMuteButton();
    initCharts();
    initFullscreen();
    document.getElementById('power-toggle').addEventListener('click', togglePower);
    document.getElementById('magnet-btn').addEventListener('click', toggleMagnet);
    document.getElementById('exploded-btn').addEventListener('click', toggleExploded);
    
    log('Sistema operativo. Cargando lienzo de simulación física...');
    
    // Loop de Telemetría Dinámica en Tiempo Real
    setInterval(()=>{ 
      if(state.power) {
        renderMotorCards();
        if (Math.random() > 0.6) animateChartsOnPower();
      } 
    }, 1400);
  }

  return { init, state, log, togglePower, toggleMagnet, motorPulse };
})();
