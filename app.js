// --- CONFIGURACIÓN DE LA ESCENA ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010204);

// CÁMARA INICIAL: vista general de la nueva grúa de torre reticulada
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
const defaultCameraPos = new THREE.Vector3(10.0, 6.0, 11.0);
const defaultControlsTarget = new THREE.Vector3(0, 3.0, 0);

camera.position.copy(defaultCameraPos);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Controles de órbita
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 26;
controls.minDistance = 1.4;
controls.enablePan = true;
controls.target.copy(defaultControlsTarget);

// UI de Información
const infoCard = document.getElementById('info-card');
const infoTitle = document.getElementById('info-title');
const infoText = document.getElementById('info-text');

// --- ESTADOS DE CÁMARA ---
const targetCameraPos = new THREE.Vector3().copy(defaultCameraPos);
const targetControlsTarget = new THREE.Vector3().copy(defaultControlsTarget);
let targetLightIntensity = 0;
let targetAmbientIntensity = 1.0; 
let isTransitioning = false;

// --- ILUMINACIÓN DINÁMICA ---
const ambientLight = new THREE.AmbientLight(0x0f172a, 1.2); // Azul nocturno de soporte
scene.add(ambientLight);
const backLight = new THREE.DirectionalLight(0x38bdf8, 1.8); // Luz de luna cyberpunk
backLight.position.set(-10, 12, -10);
scene.add(backLight);
const cyanLight = new THREE.PointLight(0x00f2fe, 3.5, 20); // Neón cian de ambiente
cyanLight.position.set(4, 6, 4);
scene.add(cyanLight);

const selectionLight = new THREE.PointLight(0xffffff, 0, 8, 1.2);
scene.add(selectionLight);

// --- ESTADO INTERNO DEL SISTEMA ---
const motionState = {
    power: true,
    giroVelocity: 0,       
    giroTargetVelocity: 0, 
    currentRotationY: 0,   
    
    cableVelocity: 0,      
    cableTargetVelocity: 0,
    cableHeight: -1.2,     
    
    magnetActive: false,
    explosionFactor: 0.0,
    targetExplosion: 0.0
};

// --- GRUPOS ---
const mechanicalGroup = new THREE.Group();
const currentGroup = new THREE.Group();
const fieldsGroup = new THREE.Group();
scene.add(mechanicalGroup, currentGroup, fieldsGroup);

// --- MATERIALES REALISTAS (FÍSICOS - PBR) ---
// Amarillo Industrial deslucido/mate (Ocre de maquinaria real)
const strutMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xd49a17, 
    roughness: 0.52, 
    metalness: 0.45,
    transparent: true 
});

// Metal Maquinaria Oscuro Pulido (Evita la contaminación del color neón verde)
const metalMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2d3238, 
    roughness: 0.28, 
    metalness: 0.85, 
    transparent: true, 
    opacity: 1.0 
});

const activeCopperMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true, transparent: true, opacity: 1.0 });
const copperOrangeMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.95, roughness: 0.15, transparent: true });
const rubberBeltMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.95, transparent: true });
const fieldLineMat = new THREE.LineBasicMaterial({ color: 0x9d4edd, transparent: true, opacity: 0.8 });
const electronMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9, metalness: 0.02, transparent: true });

// Helper: crea una viga cilíndrica entre dos puntos
function beamBetween(p1, p2, r, material) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), material);
    mesh.position.copy(p1).lerp(p2, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
}

// Helper: torre de celosía
function buildLatticeTower(height, half) {
    const g = new THREE.Group();
    const postR = 0.05;
    const posts = [[-half, -half], [half, -half], [half, half], [-half, half]];
    posts.forEach(([x, z]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(postR, postR, height, 10), metalMaterial);
        post.position.set(x, height / 2, z);
        g.add(post);
    });
    const segs = Math.max(3, Math.round(height / 0.9));
    const segH = height / segs;
    for (let i = 0; i <= segs; i++) {
        const y = i * segH;
        for (let k = 0; k < 4; k++) {
            const a = posts[k], b = posts[(k + 1) % 4];
            g.add(beamBetween(new THREE.Vector3(a[0], y, a[1]), new THREE.Vector3(b[0], y, b[1]), 0.03, strutMaterial));
        }
        if (i < segs) {
            for (let k = 0; k < 4; k++) {
                const a = posts[k], b = posts[(k + 1) % 4];
                g.add(beamBetween(new THREE.Vector3(a[0], y, a[1]), new THREE.Vector3(b[0], y + segH, b[1]), 0.02, strutMaterial));
                g.add(beamBetween(new THREE.Vector3(b[0], y, b[1]), new THREE.Vector3(a[0], y + segH, a[1]), 0.02, strutMaterial));
            }
        }
    }
    return g;
}

// --- MODELADO DE LA ESTRUCTURA ---
const grid = new THREE.GridHelper(40, 40, 0x00e5ff, 0x05080f);
grid.position.y = 0;
mechanicalGroup.add(grid);

// Toma corriente de pared
const outletGroup = new THREE.Group();
outletGroup.position.set(-4.2, 0.9, -2.2);
mechanicalGroup.add(outletGroup);

const outletBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.2), metalMaterial);
outletGroup.add(outletBox);

const plateGeo = new THREE.BoxGeometry(0.3, 0.5, 0.02);
const plateMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true });
const outletPlate = new THREE.Mesh(plateGeo, plateMat);
outletPlate.position.z = 0.11;
outletGroup.add(outletPlate);

// Base de la torre
const towerHeight = 4.4;
const baseSlab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), metalMaterial);
baseSlab.position.y = 0.1;
mechanicalGroup.add(baseSlab);
for (const [x, z] of [[-1.05, -1.05], [1.05, -1.05], [1.05, 1.05], [-1.05, 1.05]]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), copperOrangeMat);
    bolt.position.set(x, 0.2, z);
    mechanicalGroup.add(bolt);
}

// Torre de celosía, fija
const tower = buildLatticeTower(towerHeight, 0.55);
mechanicalGroup.add(tower);

// Capa de madera contrachapada
const woodCap = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.3, 1.15), woodMaterial);
woodCap.position.y = towerHeight + 0.15;
mechanicalGroup.add(woodCap);

// Pluma Giratoria (contiene todo lo que rota)
const jibGroup = new THREE.Group();
jibGroup.position.y = towerHeight + 0.32;
mechanicalGroup.add(jibGroup);

// Brazo horizontal tipo cercha
const armLen = 4.2;
const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.3, 0.26), metalMaterial);
arm.position.set(armLen / 2 - 0.9, 0.46, 0);
jibGroup.add(arm);
const tipX = armLen - 0.9 - 0.1; 

const counterArm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.26, 0.24), metalMaterial);
counterArm.position.set(-1.4, 0.46, 0);
jibGroup.add(counterArm);

const counterweight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), metalMaterial);
counterweight.position.set(-1.9, 0.4, 0);
jibGroup.add(counterweight);

// Soporte Triangular "A"
const aFrameGroup = new THREE.Group();
jibGroup.add(aFrameGroup);

const apexHeight = 1.4, apexHalfSpan = 1.1, apexDepth = 0.4;
const apexTop = new THREE.Vector3(0, apexHeight, 0);
const apexBaseL = new THREE.Vector3(-apexHalfSpan, 0, 0);
const apexBaseR = new THREE.Vector3(apexHalfSpan, 0, 0);
const legL = beamBetween(apexBaseL, apexTop, 0.05, strutMaterial);
const legR = beamBetween(apexBaseR, apexTop, 0.05, strutMaterial);
const crossBar = beamBetween(new THREE.Vector3(-apexHalfSpan * 0.45, apexHeight * 0.55, 0), new THREE.Vector3(apexHalfSpan * 0.45, apexHeight * 0.55, 0), 0.035, strutMaterial);
const legL2 = beamBetween(new THREE.Vector3(-apexHalfSpan, 0, apexDepth), apexTop, 0.04, strutMaterial);
const legR2 = beamBetween(new THREE.Vector3(apexHalfSpan, 0, apexDepth), apexTop, 0.04, strutMaterial);
const baseBarF = beamBetween(apexBaseL, apexBaseR, 0.04, strutMaterial);
const baseBarB = beamBetween(new THREE.Vector3(-apexHalfSpan, 0, apexDepth), new THREE.Vector3(apexHalfSpan, 0, apexDepth), 0.04, strutMaterial);
aFrameGroup.add(legL, legR, crossBar, legL2, legR2, baseBarF, baseBarB);

// Creador de motores detallados
function createDetailedWindshieldMotor() {
    const motorGroup = new THREE.Group();
    const statorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.35, 16);
    const stator = new THREE.Mesh(statorGeo, metalMaterial);
    stator.rotation.x = Math.PI / 2;
    motorGroup.add(stator);

    const gearBoxGeo = new THREE.BoxGeometry(0.24, 0.08, 0.28);
    const gearBox = new THREE.Mesh(gearBoxGeo, metalMaterial);
    gearBox.position.set(0.1, -0.12, 0);
    motorGroup.add(gearBox);

    const windGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16);
    const windingL = new THREE.Mesh(windGeo, copperOrangeMat);
    windingL.rotation.x = Math.PI / 2;
    windingL.position.z = 0.18;
    const windingR = windingL.clone();
    windingR.position.z = -0.18;
    motorGroup.add(windingL, windingR);

    const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
    const shaft = new THREE.Mesh(shaftGeo, metalMaterial);
    shaft.rotation.x = Math.PI / 2;
    motorGroup.add(shaft);

    return motorGroup;
}

// 1. Motor de Elevación
const motorLiftGroup = createDetailedWindshieldMotor();
motorLiftGroup.position.set(0, 1.3, 0);
aFrameGroup.add(motorLiftGroup);

const liftPulleyGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 24);
const liftPulley = new THREE.Mesh(liftPulleyGeo, copperOrangeMat);
liftPulley.rotation.x = Math.PI / 2;
liftPulley.position.set(0, 1.3, 0.18);
aFrameGroup.add(liftPulley);

// 2. Motor de Giro
const motorRotGroup = createDetailedWindshieldMotor();
motorRotGroup.position.set(-0.6, -0.4, 0);
motorRotGroup.rotation.z = Math.PI / 2;
jibGroup.add(motorRotGroup);

const drivePulleyGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16);
const drivePulley = new THREE.Mesh(drivePulleyGeo, copperOrangeMat);
drivePulley.position.set(-0.6, -0.15, 0);
jibGroup.add(drivePulley);

const beltGeo = new THREE.BoxGeometry(0.65, 0.03, 0.06);
const transmissionBelt = new THREE.Mesh(beltGeo, rubberBeltMat);
transmissionBelt.position.set(-0.3, -0.15, 0);
jibGroup.add(transmissionBelt);

// --- ELECTROIMÁN (Sujeto al cable tensor) ---
const magnetGroup = new THREE.Group();
magnetGroup.position.set(tipX, motionState.cableHeight, 0);
jibGroup.add(magnetGroup);

const core = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 16), metalMaterial);
magnetGroup.add(core);

const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 16), activeCopperMat);
magnetGroup.add(coil);

// Cable dinámico de acero tensor
let steelCable;
function updateSteelCable() {
    if (steelCable) jibGroup.remove(steelCable);
    const points = [
        new THREE.Vector3(0, 1.3, 0),
        new THREE.Vector3(tipX, 0.46, 0),
        new THREE.Vector3(tipX, motionState.cableHeight + 0.25, 0)
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 32, 0.015, 8, false);
    steelCable = new THREE.Mesh(geo, metalMaterial);
    jibGroup.add(steelCable);
}
updateSteelCable();

// --- OBJETO DE CARGA INTERACTIVO (CONTENEDOR DE ACERO DESGASTADO CON DETALLES DE NEÓN) ---
const cargoGroup = new THREE.Group();
cargoGroup.position.set(tipX, 0.5, 0);
scene.add(cargoGroup);

// Cuerpo del contenedor metálico (Más brillante y con micro-textura visual)
const cargoGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
const cargoMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x334155, // Azul acero oscuro de maquinaria
    metalness: 0.9, 
    roughness: 0.25,
    transparent: true,
    opacity: 1.0
});
const cargoMesh = new THREE.Mesh(cargoGeometry, cargoMaterial);
cargoGroup.add(cargoMesh);

// Línea cyberpunk sutil de neón magenta para hacerlo visible en la penumbra
const edgesGeo = new THREE.EdgesGeometry(cargoGeometry);
const lineMat = new THREE.LineBasicMaterial({ color: 0xff0055, linewidth: 2.2 }); 
const cargoWireframe = new THREE.LineSegments(edgesGeo, lineMat);
cargoGroup.add(cargoWireframe);

let isCargoAttached = false;

// --- SISTEMA ELÉCTRICO DE CABLES Y ELECTRONES CONECTADOS ---
// 1. Cable estático (Alimentación In -> Mástil)
const staticPathPoints = [
    new THREE.Vector3(-4.2, 0.9, -2.2),
    new THREE.Vector3(-2.5, 2.0, -1.2),
    new THREE.Vector3(-0.3, 4.0, -0.3),
    new THREE.Vector3(0, towerHeight + 0.32, 0)
];
const staticPath = new THREE.CatmullRomCurve3(staticPathPoints);
const staticCableGeo = new THREE.TubeGeometry(staticPath, 64, 0.03, 8, false);
const staticCable = new THREE.Mesh(staticCableGeo, new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8, metalness: 0.7 }));
currentGroup.add(staticCable);

// 2. Cable dinámico local en la pluma (Sigue el movimiento del electroimán)
let localJibPath;
let localJibCable;
function updateJibCableAndPath() {
    if (localJibCable) jibGroup.remove(localJibCable);
    
    localJibPathPoints = [
        new THREE.Vector3(0, -0.1, 0),
        new THREE.Vector3(0, 0.6, 0),
        new THREE.Vector3(tipX * 0.7, 0.35, 0),
        new THREE.Vector3(tipX, motionState.cableHeight + 0.22, 0)
    ];
    localJibPath = new THREE.CatmullRomCurve3(localJibPathPoints);
    const geo = new THREE.TubeGeometry(localJibPath, 64, 0.02, 8, false);
    localJibCable = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8, metalness: 0.7 }));
    jibGroup.add(localJibCable);
}
updateJibCableAndPath();

// Generación de electrones
const numStaticElectrons = 18;
const staticElectrons = [];
const eGeo = new THREE.SphereGeometry(0.04, 8, 8);
for (let i = 0; i < numStaticElectrons; i++) {
    const el = new THREE.Mesh(eGeo, electronMat);
    currentGroup.add(el);
    staticElectrons.push({ mesh: el, progress: i / numStaticElectrons });
}

const numJibElectrons = 18;
const jibElectrons = [];
for (let i = 0; i < numJibElectrons; i++) {
    const el = new THREE.Mesh(eGeo, electronMat);
    jibGroup.add(el);
    jibElectrons.push({ mesh: el, progress: i / numJibElectrons });
}

// --- LEYES FÍSICAS EN COMPONENTES ---
const physicsVisualsGroup = new THREE.Group();
scene.add(physicsVisualsGroup);

// Ampère-Maxwell: Anillos concéntricos montados sobre el cable estático de alimentación
const ampereRingsGroup = new THREE.Group();
physicsVisualsGroup.add(ampereRingsGroup);

const numAmpereSets = 4;
const ampereSets = [];
for (let s = 0; s < numAmpereSets; s++) {
    const setGroup = new THREE.Group();
    const ringI = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.15, 30), new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide, transparent: true }));
    const ringO = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.28, 30), new THREE.MeshBasicMaterial({ color: 0x9d4edd, side: THREE.DoubleSide, transparent: true }));
    ringI.rotation.x = Math.PI / 2;
    ringO.rotation.x = Math.PI / 2;
    setGroup.add(ringI, ringO);
    ampereRingsGroup.add(setGroup);
    ampereSets.push({ group: setGroup, inner: ringI, outer: ringO, progressOffset: s / numAmpereSets });
}

// Faraday-Lenz: Se asocia físicamente al electroimán
const faradayGroup = new THREE.Group();
physicsVisualsGroup.add(faradayGroup);

const eddyRing1 = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32), new THREE.MeshBasicMaterial({ color: 0xff0055, side: THREE.DoubleSide, transparent: true }));
const eddyRing2 = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.25, 32), new THREE.MeshBasicMaterial({ color: 0xff0055, side: THREE.DoubleSide, transparent: true }));
const eddyRing3 = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xff0055, side: THREE.DoubleSide, transparent: true }));
eddyRing1.rotation.x = Math.PI / 2;
eddyRing2.rotation.x = Math.PI / 2;
eddyRing3.rotation.x = Math.PI / 2;
faradayGroup.add(eddyRing1, eddyRing2, eddyRing3);

// Vectores de Lorentz (junto al motor de giro)
const lorentzVectorsGroup = new THREE.Group();
physicsVisualsGroup.add(lorentzVectorsGroup);

const lorentzOrigin = new THREE.Vector3(-0.6, towerHeight + 0.32 - 0.4, 0.35);
const arrowB = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0).normalize(), lorentzOrigin, 0.6, 0x00f2fe, 0.15, 0.08);
const arrowF = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0).normalize(), lorentzOrigin, 0.6, 0xff00ff, 0.15, 0.08);
lorentzVectorsGroup.add(arrowB, arrowF);

// Vectores Mecánicos (Siguen dinámicamente al gancho / motor)
const mechanicalVectorsGroup = new THREE.Group();
physicsVisualsGroup.add(mechanicalVectorsGroup);

const arrowTension = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0).normalize(), new THREE.Vector3(), 0.7, 0xd49a17, 0.15, 0.08);
const torqueOrigin = new THREE.Vector3(0, towerHeight + 0.32 + 1.3, 0.28);
const arrowTorque = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1).normalize(), torqueOrigin, 0.5, 0xb45309, 0.15, 0.08);
mechanicalVectorsGroup.add(arrowTension, arrowTorque);

// Esfera de campo electromagnético local para el imán
const localMagnetFieldsGroup = new THREE.Group();
magnetGroup.add(localMagnetFieldsGroup);

const fieldSphereGeo = new THREE.SphereGeometry(0.85, 16, 12);
const fieldSphereWire = new THREE.WireframeGeometry(fieldSphereGeo);
const magnetShield = new THREE.LineSegments(fieldSphereWire);
magnetShield.material = new THREE.LineBasicMaterial({ color: 0x9d4edd, transparent: true, opacity: 0.6 });
localMagnetFieldsGroup.add(magnetShield);

const dipoleGroup = new THREE.Group();
localMagnetFieldsGroup.add(dipoleGroup);
for (let r = 0; r < Math.PI * 2; r += Math.PI / 4) {
    const points = [];
    for (let t = 0; t <= Math.PI; t += 0.1) {
        const radius = 0.8 * Math.sin(t);
        const y = 0.7 * Math.cos(t);
        points.push(new THREE.Vector3(radius * Math.cos(r), y, radius * Math.sin(r)));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(30));
    const fieldLine = new THREE.Line(lineGeo, fieldLineMat);
    dipoleGroup.add(fieldLine);
}

// Posiciones iniciales para Vista Explosionada
const initialPositions = {
    tower: tower.position.clone(),
    woodCap: woodCap.position.clone(),
    jibGroup: jibGroup.position.clone(),
    outletGroup: outletGroup.position.clone()
};

// --- PUNTOS DE INTERACCIÓN (GIROSCOPIOS) ---
const clickTargets = [];
const activeHotspots = [];

function createHighTechHotspot(parentGroup, localPos, id, title, desc, colorHex) {
    const hotspotContainer = new THREE.Group();

    const coreGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    hotspotContainer.add(coreMesh);

    const ringGeom = new THREE.TorusGeometry(0.2, 0.015, 8, 32);
    const ringMatH = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.7 });
    const ringH = new THREE.Mesh(ringGeom, ringMatH);
    ringH.rotation.x = Math.PI / 2;
    hotspotContainer.add(ringH);

    const ringMatV = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const ringV = new THREE.Mesh(ringGeom, ringMatV);
    ringV.rotation.y = Math.PI / 4;
    hotspotContainer.add(ringV);

    hotspotContainer.position.copy(localPos);
    parentGroup.add(hotspotContainer);

    const collGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const collMat = new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 });
    const collMesh = new THREE.Mesh(collGeo, collMat);
    collMesh.position.copy(localPos);
    parentGroup.add(collMesh);

    activeHotspots.push({ container: hotspotContainer, ringH: ringH, ringV: ringV, core: coreMesh });

    collMesh.userData = {
        id: id,
        parent: parentGroup,
        hotspot: hotspotContainer,
        title: title,
        description: desc,
        colorCard: colorHex
    };
    clickTargets.push(collMesh);
}

createHighTechHotspot(localMagnetFieldsGroup, new THREE.Vector3(0, 0.6, 0), 'magneto', 'Ley de Faraday-Lenz', `
    <span class="ic-eyebrow">Electromagnetismo · Inducción</span>
    <div class="ic-formula">$$\\mathcal{E} = -\\frac{d\\Phi_B}{dt}$$</div>
    <ul class="ic-vars">
        <li><b>ε</b> Fuerza electromotriz inducida (V)</li>
        <li><b>Φ_B</b> Flujo magnético a través de la bobina (Wb)</li>
        <li><b>dt</b> Variación de tiempo (s)</li>
    </ul>
    <p class="ic-desc"><strong>Este es el núcleo del electroimán.</strong> Al suministrar corriente variable a la bobina, se genera un flujo magnético variable que induce corriente en el metal cercano.</p>
    <p class="ic-desc">El signo negativo (Ley de Lenz) indica que la corriente inducida siempre se opone al cambio que la produjo, estabilizando el campo mientras el sistema está encendido.</p>
`, 0x9d4edd);

createHighTechHotspot(motorRotGroup, new THREE.Vector3(0, 0.45, 0), 'motorGiro', 'Fuerza de Lorentz (Giro)', `
    <span class="ic-eyebrow">Electromagnetismo · Fuerza motriz</span>
    <div class="ic-formula">$$\\mathbf{F} = I(\\mathbf{L} \\times \\mathbf{B})$$</div>
    <ul class="ic-vars">
        <li><b>F</b> Fuerza mecánica resultante (N)</li>
        <li><b>I</b> Corriente en el devanado del motor (A)</li>
        <li><b>L</b> Longitud del conductor dentro del campo (m)</li>
        <li><b>B</b> Campo magnético del motor (T)</li>
    </ul>
    <p class="ic-desc">Este motor gira la torre completa de la grúa. El campo magnético interno empuja el conductor con corriente, generando el torque que produce el giro izquierdo/derecho.</p>
`, 0x00f2fe);

createHighTechHotspot(motorLiftGroup, new THREE.Vector3(0, 0.45, 0), 'motorElevacion', 'Trabajo, Torque y Tensión', `
    <span class="ic-eyebrow">Mecánica · Equilibrio de torque</span>
    <div class="ic-formula">$$\\boldsymbol{\\tau} = \\mathbf{r} \\times \\mathbf{F}$$</div>
    <ul class="ic-vars">
        <li><b>τ</b> Torque aplicado al tambor de izado (N·m)</li>
        <li><b>r</b> Radio del tambor (m)</li>
        <li><b>F</b> Tensión del cable de elevación (N)</li>
    </ul>
    <p class="ic-desc">Este motor enrolla el cable que sostiene el electroimán. Su torque debe superar el peso de la carga (mg) para poder elevarla con seguridad.</p>
`, 0xd49a17);

createHighTechHotspot(currentGroup, new THREE.Vector3(-1.4, 3.0, -0.75), 'cableConexion', 'Ley de Ampère-Maxwell', `
    <span class="ic-eyebrow">Electromagnetismo · Origen del campo</span>
    <div class="ic-formula">$$\\oint \\mathbf{B} \\cdot d\\mathbf{l} = \\mu_0 I$$</div>
    <ul class="ic-vars">
        <li><b>B</b> Campo magnético inducido (T)</li>
        <li><b>dl</b> Elemento diferencial de la trayectoria cerrada</li>
        <li><b>μ₀</b> Permeabilidad magnética del vacío</li>
        <li><b>I</b> Corriente que circula por el cable (A)</li>
    </ul>
    <p class="ic-desc">Toda corriente eléctrica genera un campo magnético a su alrededor. Este cable alimenta al electroimán, y las líneas de campo concéntricas que produce son la base de todo el sistema.</p>
`, 0x10b981);

createHighTechHotspot(cargoGroup, new THREE.Vector3(0, 0.5, 0), 'cargaMetalica', 'Ferromagnetismo y Saturación', `
    <span class="ic-eyebrow">Ciencia de materiales · Magnetización</span>
    <div class="ic-formula">$$\\mathbf{B} = \\mu_0(\\mathbf{H} + \\mathbf{M})$$</div>
    <ul class="ic-vars">
        <li><b>B</b> Densidad de flujo dentro del material (T)</li>
        <li><b>H</b> Campo magnético externo aplicado (A/m)</li>
        <li><b>M</b> Magnetización inducida en el material (A/m)</li>
    </ul>
    <p class="ic-desc"><strong>Solo los materiales ferromagnéticos</strong> —como el hierro, el níquel o el acero de esta carga— responden con fuerza al electroimán: sus dominios magnéticos se alinean con el campo externo.</p>
    <p class="ic-desc">Al cortar la corriente, el material pierde casi toda su magnetización, liberando la carga. Un pequeño remanente (retentividad) puede dejarla ligeramente magnetizada.</p>
`, 0xff3b4e);

createHighTechHotspot(mechanicalGroup, new THREE.Vector3(0, towerHeight + 0.15, 0.5), 'aislante', 'Aislamiento y Circuito Magnético', `
    <span class="ic-eyebrow">Ingeniería · Reluctancia magnética</span>
    <div class="ic-formula">$$\\mathcal{R} = \\frac{l}{\\mu_0 \\mu_r A}$$</div>
    <ul class="ic-vars">
        <li><b>ℛ</b> Reluctancia del circuito magnético (A·vuelta/Wb)</li>
        <li><b>l</b> Longitud del trayecto del flujo (m)</li>
        <li><b>μᵣ</b> Permeabilidad relativa del material</li>
        <li><b>A</b> Área de la sección transversal (m²)</li>
    </ul>
    <p class="ic-desc">Esta capa de madera contrachapada aísla eléctricamente la torre metálica del electroimán, evitando cortocircuitos, mientras ofrece alta reluctancia: no interfiere con el circuito magnético del núcleo.</p>
`, 0xb98a52);

// --- GESTIÓN DE INTERACCIÓN ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let activeTarget = null;

function updateSelectionDynamics() {
    if (activeTarget) {
        isTransitioning = true;
        controls.enabled = false;

        const targetWorldPos = new THREE.Vector3();
        activeTarget.getWorldPosition(targetWorldPos);

        const closeUpDistance = 5.5;
        const direction = new THREE.Vector3(0.5, 0.25, 0.83).normalize();

        targetControlsTarget.copy(targetWorldPos);
        targetCameraPos.copy(targetWorldPos).add(direction.multiplyScalar(closeUpDistance));

        const lightOffset = new THREE.Vector3().copy(direction).multiplyScalar(0.6);
        selectionLight.position.copy(targetWorldPos).add(lightOffset).add(new THREE.Vector3(0, 0.4, 0));
        selectionLight.color.setHex(activeTarget.userData.colorCard);

        targetLightIntensity = 18.0; 
        targetAmbientIntensity = 0.4; 
    } else {
        targetLightIntensity = 0;
        targetAmbientIntensity = 1.0;
        isTransitioning = false;
        controls.enabled = true;
    }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    clickTargets.forEach(t => t.updateMatrixWorld(true));
    const intersects = raycaster.intersectObjects(clickTargets);

    if (intersects.length > 0) {
        const hitObject = intersects[0].object;
        if (activeTarget && activeTarget.userData.id === hitObject.userData.id) {
            activeTarget = null;
        } else {
            activeTarget = hitObject;
        }
    } else {
        activeTarget = null;
    }

    updateSelectionDynamics();
    updateUI();
});

function updateUI() {
    if (activeTarget) {
        const hexColor = "#" + activeTarget.userData.colorCard.toString(16).padStart(6, '0');
        infoTitle.innerText = activeTarget.userData.title;
        infoText.innerHTML = activeTarget.userData.description;
        infoCard.style.border = `1.5px solid ${hexColor}`;
        infoCard.style.boxShadow = `-10px 0 35px ${hexColor}33`;
        infoCard.style.display = 'block';
        setTimeout(() => { infoCard.style.opacity = '1'; }, 10);

        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            MathJax.typesetPromise([infoText]).catch(err => console.log("MathJax loading error:", err));
        }
    } else {
        infoCard.style.opacity = '0';
        setTimeout(() => { infoCard.style.display = 'none'; }, 300);
    }
}

function applyHolographicOpacity(targetId) {
    if (!targetId) {
        setGroupMaterialProperties(mechanicalGroup, 1.0, false);
        setGroupMaterialProperties(currentGroup, 1.0, false);
        if (cargoMesh) {
            cargoMesh.material.transparent = false;
            cargoMesh.material.opacity = 1.0;
        }
        if (cargoWireframe) {
            cargoWireframe.material.opacity = 1.0;
        }
        return;
    }

    setGroupMaterialProperties(mechanicalGroup, 0.12, true);
    setGroupMaterialProperties(currentGroup, 0.12, true);
    if (cargoMesh) {
        cargoMesh.material.transparent = true;
        cargoMesh.material.opacity = 0.12;
    }
    if (cargoWireframe) {
        cargoWireframe.material.opacity = 0.12;
    }

    if (targetId === 'magneto') {
        setGroupMaterialProperties(magnetGroup, 1.0, false);
        steelCable.material.opacity = 1.0;
        steelCable.material.transparent = false;
        if (cargoMesh && isCargoAttached) {
            cargoMesh.material.transparent = false;
            cargoMesh.material.opacity = 1.0;
            cargoWireframe.material.opacity = 1.0;
        }
    } else if (targetId === 'motorGiro') {
        setGroupMaterialProperties(motorRotGroup, 1.0, false);
        drivePulley.material.opacity = 1.0;
        drivePulley.material.transparent = false;
        transmissionBelt.material.opacity = 1.0;
        transmissionBelt.material.transparent = false;
    } else if (targetId === 'motorElevacion') {
        setGroupMaterialProperties(motorLiftGroup, 1.0, false);
        liftPulley.material.opacity = 1.0;
        liftPulley.material.transparent = false;
        aFrameGroup.traverse(child => {
            if (child.isMesh) { child.material.opacity = 0.8; child.material.transparent = true; }
        });
    } else if (targetId === 'cableConexion') {
        setGroupMaterialProperties(outletGroup, 1.0, false);
        staticCable.material.opacity = 1.0;
        staticCable.material.transparent = false;
        setGroupMaterialProperties(currentGroup, 1.0, false);
    }
}

function setGroupMaterialProperties(group, opacity, transparent) {
    group.traverse(child => {
        if (child.isMesh && child.material) {
            if (child.material === electronMat || child.material === activeCopperMat) return;
            child.material.transparent = transparent;
            child.material.opacity = opacity;
        }
        if (child.isLine && child.material) {
            if (child.material === lineMat) return; 
            child.material.transparent = transparent;
            child.material.opacity = opacity * 0.7;
        }
    });
}

// --- ESCUCHA DE MENSAJES ---
window.addEventListener('message', (event) => {
    const { action, value } = event.data;
    if (!action) return;

    switch (action) {
        case 'setPower':
            motionState.power = !!value;
            if (!value) {
                motionState.magnetActive = false;
                coil.material = strutMaterial;
                motionState.giroTargetVelocity = 0;
                motionState.cableTargetVelocity = 0;
            } else {
                coil.material = activeCopperMat;
            }
            break;

        case 'moveMotor':
            if (!motionState.power) return;
            if (value.motor === 'giro') {
                motionState.giroTargetVelocity = 0.015 * value.direction;
            } else if (value.motor === 'elevacion') {
                motionState.cableTargetVelocity = 0.012 * value.direction;
            }
            break;

        case 'stopMotor':
            if (value.motor === 'giro') motionState.giroTargetVelocity = 0;
            if (value.motor === 'elevacion') motionState.cableTargetVelocity = 0;
            break;

        case 'setMagnet':
            if (!motionState.power) return;
            motionState.magnetActive = !!value;
            break;

        case 'setExploded':
            motionState.targetExplosion = value ? 1.0 : 0.0;
            break;
    }
});

// --- BUCLE DE ANIMACIÓN PRINCIPAL ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    motionState.giroVelocity = THREE.MathUtils.lerp(motionState.giroVelocity, motionState.giroTargetVelocity, 0.05);
    motionState.cableVelocity = THREE.MathUtils.lerp(motionState.cableVelocity, motionState.cableTargetVelocity, 0.05);

    if (Math.abs(motionState.giroVelocity) > 0.0001) {
        motionState.currentRotationY += motionState.giroVelocity;
    }
    jibGroup.rotation.y = motionState.currentRotationY;

    if (Math.abs(motionState.cableVelocity) > 0.0001) {
        motionState.cableHeight = Math.max(-3.8, Math.min(-0.2, motionState.cableHeight + motionState.cableVelocity));
        magnetGroup.position.y = motionState.cableHeight;
        
        updateSteelCable();
        updateJibCableAndPath();
    }

    // Gravedad del Cargamento Metálico
    const magnetWorldPos = new THREE.Vector3();
    magnetGroup.getWorldPosition(magnetWorldPos);

    if (motionState.magnetActive && motionState.power) {
        const distance = magnetWorldPos.distanceTo(cargoGroup.position);
        
        if (distance < 1.6 || isCargoAttached) {
            isCargoAttached = true;
            cargoGroup.position.copy(magnetWorldPos);
            cargoGroup.position.y -= 0.65; 
        }
    } else {
        isCargoAttached = false;
        if (cargoGroup.position.y > 0.5) {
            cargoGroup.position.y = THREE.MathUtils.lerp(cargoGroup.position.y, 0.5, 0.15);
        }
    }

    // Efecto Vista Explosionada
    motionState.explosionFactor = THREE.MathUtils.lerp(motionState.explosionFactor, motionState.targetExplosion, 0.08);
    tower.position.y = initialPositions.tower.y - (motionState.explosionFactor * 0.8);
    woodCap.position.y = initialPositions.woodCap.y + (motionState.explosionFactor * 0.4);
    jibGroup.position.y = initialPositions.jibGroup.y + (motionState.explosionFactor * 1.5);
    outletGroup.position.x = initialPositions.outletGroup.x - (motionState.explosionFactor * 1.2);

    // Hotspots de interacción
    activeHotspots.forEach(hotspot => {
        hotspot.ringH.rotation.z += 0.015;
        hotspot.ringV.rotation.x -= 0.01;
        hotspot.ringV.rotation.y += 0.015;
        const pulse = 1.0 + Math.sin(elapsed * 3) * 0.15;
        hotspot.container.scale.set(pulse, pulse, pulse);
    });

    applyHolographicOpacity(activeTarget ? activeTarget.userData.id : null);

    // Mostrar/ocultar efectos visuales
    if (activeTarget) {
        const id = activeTarget.userData.id;
        lorentzVectorsGroup.visible = (id === 'motorGiro');
        mechanicalVectorsGroup.visible = (id === 'motorElevacion');
        faradayGroup.visible = (id === 'magneto');
        ampereRingsGroup.visible = (id === 'cableConexion');
    } else {
        lorentzVectorsGroup.visible = false;
        mechanicalVectorsGroup.visible = false;
        faradayGroup.visible = false;
        ampereRingsGroup.visible = true;
    }

    if (ampereRingsGroup.visible) {
        ampereSets.forEach((set) => {
            const progress = (set.progressOffset + elapsed * 0.08) % 1.0;
            const pointOnPath = staticPath.getPointAt(progress);
            set.group.position.copy(pointOnPath);

            const tangent = staticPath.getTangentAt(progress).normalize();
            set.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

            const waveScale = 0.8 + ((elapsed * 2.5 + set.progressOffset * 4) % 1.2) * 0.5;
            set.outer.scale.set(waveScale, waveScale, 1);
            set.outer.material.opacity = 1.0 - ((waveScale - 0.8) / 0.9);
        });
    }

    // Faraday-Lenz
    if (faradayGroup.visible) {
        const magnetWorldPos = new THREE.Vector3();
        magnetGroup.getWorldPosition(magnetWorldPos);
        faradayGroup.position.copy(magnetWorldPos).y -= 0.35;
        
        const pulse1 = (elapsed * 2.0) % 3;
        eddyRing1.scale.set(pulse1, pulse1, 1); eddyRing1.material.opacity = 1.0 - (pulse1 / 3);
        const pulse2 = ((elapsed * 2.0) + 1) % 3;
        eddyRing2.scale.set(pulse2, pulse2, 1); eddyRing2.material.opacity = 1.0 - (pulse2 / 3);
        const pulse3 = ((elapsed * 2.0) + 2) % 3;
        eddyRing3.scale.set(pulse3, pulse3, 1); eddyRing3.material.opacity = 1.0 - (pulse3 / 3);
    }

    // Vectores mecánicos
    if (mechanicalVectorsGroup.visible) {
        const hookPos = new THREE.Vector3();
        magnetGroup.getWorldPosition(hookPos);
        arrowTension.position.copy(hookPos).y += 0.35;
    }

    // Flujo de electrones
    staticElectrons.forEach(e => {
        let prog = (e.progress + elapsed * 0.12) % 1.0;
        e.mesh.position.copy(staticPath.getPointAt(prog));
    });

    jibElectrons.forEach(e => {
        let prog = (e.progress + elapsed * 0.12) % 1.0;
        e.mesh.position.copy(localJibPath.getPointAt(prog));
    });

    // Efecto electroimán activo
    if (motionState.magnetActive && motionState.power) {
        coil.material.opacity = 0.4 + Math.sin(elapsed * 12) * 0.4;
        localMagnetFieldsGroup.visible = true;
    } else {
        localMagnetFieldsGroup.visible = false;
    }

    dipoleGroup.rotation.y += 0.015;
    magnetShield.rotation.x += 0.003;
    magnetShield.rotation.y += 0.003;

    if (isTransitioning) {
        camera.position.lerp(targetCameraPos, 0.07);
        controls.target.lerp(targetControlsTarget, 0.07);

        if (camera.position.distanceTo(targetCameraPos) < 0.008) {
            isTransitioning = false;
        }
    }

    selectionLight.intensity = THREE.MathUtils.lerp(selectionLight.intensity, targetLightIntensity, 0.1);
    ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, targetAmbientIntensity, 0.1);

    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});