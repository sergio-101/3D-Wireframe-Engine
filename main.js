const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

let lines = [ [1, 2], [1, 3], [1, 5], [2, 6], [2, 4], [3, 7], [3, 4], [4, 8], [5, 6], [5, 7], [6, 8], [7, 8], ]
let State = {
    keys: {
        shift: false,
        w: false,
        s: false,
        a: false,
        d: false
    },
    velocity: {
        x: 0, y: 0, z: 0
    },
    fov: {
        x: -1, y: 0, z: -1, theta: 0,
    },
    blocks: [],
    speed : 0.04,
    normal_speed : 0.04,
    sprint_speed: 0.1,
    rotate_speed: 0.05,
    gun: [],
    gun_tilt: 0.1
}

function abs_to_screen({x, y}){
    let _x = ((x + 1)/2)*innerWidth;
    // -1..1 -> 0..2
    let _y = ((-y + 1)/2)*innerHeight;
    return {
        x: _x, 
        y: _y
    }
}

function draw_line(p1, p2, color) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}
function draw_poly(vertices, color){
    ctx.fillStyle = color;
    ctx.beginPath();
    for(let i = 0; i < vertices.length; i++){
        let vertex = vertices[i];
        if(i == 0){
            ctx.moveTo(vertex.x, vertex.y);
        }
        else{
            ctx.lineTo(vertex.x, vertex.y);
        }
    }
    ctx.closePath();
    ctx.fill();
}

function clear(){
    // ceiling
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, innerWidth, innerHeight / 2);

    // floor
    ctx.fillStyle = '#222';
    ctx.fillRect(0, innerHeight / 2, innerWidth, innerHeight / 2);
}
function project({x, y, z}){
    // z = Math.abs(z);
    return {
        x: x/z,
        y: y/z
    }
}

function rotate_on_y({x, y, z}, o, deg){
    let c = Math.cos(deg);
    let s = Math.sin(deg);
    x = x - o.x; 
    z = z - o.z; 
    return {
        x: x*c - z*s + o.x,
        y: y,
        z: x*s + z*c + o.z
    }
}

function translate({x, y, z}, d) {
    return (
        {
            x: x + d.x, 
            y: y + d.y, 
            z: z + d.z
        }
    )
}
function scalar_mul({x, y, z}, d) {
    return {x: x * d, y: y * d, z: z * d};
}
function gen_block({x, y, z}, w, h, d, color){
    return (
        {
            w, h, d, color,
            vertices: [
                {x, y, z},
                {x: x - w/2, y: y - h/2, z: z + d/2}, 
                {x: x + w/2, y: y - h/2, z: z + d/2}, 
                {x: x - w/2, y: y + h/2, z: z + d/2}, 
                {x: x + w/2, y: y + h/2, z: z + d/2}, 

                {x: x - w/2, y: y - h/2, z: z - d/2}, 
                {x: x + w/2, y: y - h/2, z: z - d/2}, 
                {x: x - w/2, y: y + h/2, z: z - d/2}, 
                {x: x + w/2, y: y + h/2, z: z - d/2}, 
            ]
        }

    )
}
function add_block({x, y, z}, w, h, d, color){
    State.blocks.push(gen_block({x, y, z}, w, h, d, color))
}
function clip_line(p1, p2) {
    let NEAR = 0.01;
    const p1_behind = p1.z < NEAR;
    const p2_behind = p2.z < NEAR;

    if (p1_behind && p2_behind) return null;
    if (!p1_behind && !p2_behind) return [p1, p2];
    // one point is behind;
    const t = (NEAR - p1.z) / (p2.z - p1.z);
    const clipped = {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
        z: NEAR
    };
    if (p1_behind) return [clipped, p2];
    else           return [p1, clipped];
}

function Key_Handler(e){
    let key = e.key.toLowerCase();
    if(key == "w" || key == "s" || key == "a" || key == "d" || key == "shift"){
        if(e.type == "keydown") State.keys[key.toLowerCase()] = true;
        else State.keys[key.toLowerCase()] = false;
    }
}

function Draw(){
    // BLOCKS
    for (block of State.blocks){
        let vertices = block.vertices; 
        let theta = State.fov.theta;
        for(let i = 0; i < lines.length; i++){
            let line = lines[i];
            let p1 = vertices[line[0]];
            let p2 = vertices[line[1]];
            let fov_adjusted_p1 = translate(p1, scalar_mul(State.fov, -1));
            fov_adjusted_p1 = rotate_on_y(fov_adjusted_p1, {x: 0, y: 0, z: 0}, theta);
            let fov_adjusted_p2 = translate(p2, scalar_mul(State.fov, -1));
            fov_adjusted_p2 = rotate_on_y(fov_adjusted_p2, {x: 0, y: 0, z: 0}, theta);
            const clipped = clip_line(fov_adjusted_p1, fov_adjusted_p2);
            if(!clipped) continue;
            draw_line(
                abs_to_screen(project(clipped[0])), 
                abs_to_screen(project(clipped[1])),
                block.color
            );
        }
    };
    for (block of State.gun){
        let vertices = block.vertices; 
        for(let i = 0; i < lines.length; i++){
            let line = lines[i];
            let p1 = vertices[line[0]];
            let p2 = vertices[line[1]];
            draw_line(
                abs_to_screen(project(p1)), 
                abs_to_screen(project(p2)),
                block.color
            );
        }
    }
}

// (todo): AI GENERATED CODE, CAN FUCK UP BIG TIME;
function generate_level(){
    // ============================================================
    // SPAWN ROOM — grey stone
    // ============================================================
    add_block({x: 0,    y: 0, z: 1},   6,  3, 0.3, '#888');   // back wall
    add_block({x: 3,    y: 0, z: 3},   0.3, 3, 4,  '#888');   // right wall
    add_block({x: -3,   y: 0, z: 3},   0.3, 3, 4,  '#888');   // left wall
    add_block({x: 0,    y: -1.6, z: 3}, 8, 0.1, 6, '#444');   // floor
    add_block({x: 0,    y: 1.6,  z: 3}, 8, 0.1, 6, '#333');   // ceiling

    // ============================================================
    // CORRIDOR 1 — dark grey
    // ============================================================
    add_block({x: 1.5,  y: 0, z: 9},   0.3, 3, 10, '#666');
    add_block({x: -1.5, y: 0, z: 9},   0.3, 3, 10, '#666');
    add_block({x: 0,    y: -1.6, z: 9}, 4, 0.1, 10, '#333');
    add_block({x: 0,    y: 1.6,  z: 9}, 4, 0.1, 10, '#222');

    // ============================================================
    // ROOM 2 — brown/dirty room
    // ============================================================
    add_block({x: 0,    y: 0, z: 20},  14,  3, 0.3, '#7a5c3a'); // back wall
    add_block({x: 7,    y: 0, z: 14},  0.3, 3, 12,  '#7a5c3a'); // right
    add_block({x: -7,   y: 0, z: 14},  0.3, 3, 12,  '#7a5c3a'); // left
    add_block({x: 0,    y: -1.6, z: 14}, 16, 0.1, 14, '#5a3e28'); // floor
    add_block({x: 0,    y: 1.6,  z: 14}, 16, 0.1, 14, '#2a1e10'); // ceiling
    // pillars
    add_block({x: 3,    y: 0, z: 14},  0.5, 3, 0.5, '#555');
    add_block({x: -3,   y: 0, z: 14},  0.5, 3, 0.5, '#555');
    add_block({x: 3,    y: 0, z: 18},  0.5, 3, 0.5, '#555');
    add_block({x: -3,   y: 0, z: 18},  0.5, 3, 0.5, '#555');

    // ============================================================
    // SECRET ALCOVE LEFT — greenish slime room
    // ============================================================
    add_block({x: -9,   y: 0, z: 14},  0.3, 3, 6,   '#2d5a27');
    add_block({x: -8,   y: 0, z: 11},  2,   3, 0.3,  '#2d5a27');
    add_block({x: -8,   y: 0, z: 17},  2,   3, 0.3,  '#2d5a27');
    add_block({x: -11,  y: 0, z: 14},  0.3, 3, 6,   '#2d5a27');
    add_block({x: -9,   y: -1.6, z: 14}, 4, 0.1, 6, '#1a3d15'); // slime floor
    // glowing green light hint
    add_block({x: -10,  y: 0, z: 14},  1, 2, 0.1,   '#00ff44');

    // ============================================================
    // CHOKEPOINT
    // ============================================================
    add_block({x: 4,    y: 0, z: 21},  6,  3, 0.3,  '#555');
    add_block({x: -4,   y: 0, z: 21},  6,  3, 0.3,  '#555');

    // ============================================================
    // CORRIDOR 2 — staggered red warning walls
    // ============================================================
    add_block({x: 2,    y: 0, z: 24},  0.3, 3, 6,   '#7a2020');
    add_block({x: -1.5, y: 0, z: 26},  0.3, 3, 6,   '#7a2020');
    add_block({x: 2.5,  y: 0, z: 29},  0.3, 3, 4,   '#7a2020');
    add_block({x: -2,   y: 0, z: 30},  0.3, 3, 4,   '#7a2020');
    add_block({x: 0,    y: -1.6, z: 27}, 6, 0.1, 10, '#3a1010');
    add_block({x: 0,    y: 1.6,  z: 27}, 6, 0.1, 10, '#1a0808');
    // red warning stripes on walls
    add_block({x: 2,    y: 0.5, z: 25},  0.1, 0.4, 0.4, '#ff0000');
    add_block({x: -1.5, y: 0.5, z: 27},  0.1, 0.4, 0.4, '#ff0000');

    // ============================================================
    // BOSS ARENA — dark metal blue
    // ============================================================
    add_block({x: 0,    y: 0, z: 42},  18,  3, 0.3,  '#1a1a3a'); // far wall
    add_block({x: 9,    y: 0, z: 36},  0.3, 3, 14,   '#1a1a3a'); // right
    add_block({x: -9,   y: 0, z: 36},  0.3, 3, 14,   '#1a1a3a'); // left
    add_block({x: 0,    y: -1.6, z: 36}, 20, 0.1, 16, '#0d0d1f'); // floor
    add_block({x: 0,    y: 1.6,  z: 36}, 20, 0.1, 16, '#080810'); // ceiling
    // broken walls
    add_block({x: 5,    y: 0, z: 34},  4,  3, 0.3,   '#333');
    add_block({x: -5,   y: 0, z: 34},  4,  3, 0.3,   '#333');
    add_block({x: 5,    y: 0, z: 40},  4,  3, 0.3,   '#333');
    add_block({x: -5,   y: 0, z: 40},  4,  3, 0.3,   '#333');
    // arena pillars
    add_block({x: 4,    y: 0, z: 35},  0.5, 3, 0.5,  '#aaaaff');
    add_block({x: -4,   y: 0, z: 35},  0.5, 3, 0.5,  '#aaaaff');
    add_block({x: 4,    y: 0, z: 40},  0.5, 3, 0.5,  '#aaaaff');
    add_block({x: -4,   y: 0, z: 40},  0.5, 3, 0.5,  '#aaaaff');
    // center altar
    add_block({x: 0,    y: 0, z: 38},  1,  1, 1,     '#ff4400');
    add_block({x: 0,    y: 0.6, z: 38}, 0.4, 0.4, 0.4, '#ffaa00');

    // ============================================================
    // EXIT CORRIDOR
    // ============================================================
    add_block({x: 1.5,  y: 0, z: 46},  0.3, 3, 8,   '#888');
    add_block({x: -1.5, y: 0, z: 46},  0.3, 3, 8,   '#888');
    add_block({x: 0,    y: 0, z: 50},  6,   3, 0.3,  '#aaa');   // exit wall
    // exit sign glow
    add_block({x: 0,    y: 0.8, z: 49.8}, 1.5, 0.4, 0.1, '#00ffff');

}


function game_loop(t){
    let d_time = t - ctime;
    if(d_time > 1000/FPS){
        clear();
        if(State.keys["shift"]){
            State.speed = State.sprint_speed;
        }
        else {
            State.speed = State.normal_speed;
        }
        if(State.keys["w"]){
            State.velocity.z = State.speed;
        }
        else if(State.keys["s"]){
            State.velocity.z = -State.speed;
        }
        else{
            State.velocity.z = 0;
        }
        if(State.keys["a"]){
            State.velocity.x = -State.speed;
        }
        else if(State.keys["d"]){
            State.velocity.x = State.speed;
        }
        else{
            State.velocity.x = 0;
        }
        let rot_velocity = rotate_on_y(State.velocity, {x: 0, y: 0, z: 0}, -State.fov.theta); 
        State.fov.x += rot_velocity.x;
        State.fov.z += rot_velocity.z;
        Draw();
        ctime = t;
    }
    requestAnimationFrame(game_loop);
}

// SETUP
addEventListener("keydown", Key_Handler);
addEventListener("keyup", Key_Handler);
canvas.addEventListener("click", () => canvas.requestPointerLock());
addEventListener("mousemove", e => {
    if(document.pointerLockElement === canvas){
        State.fov.theta += e.movementX * 0.002;
    }
});

let ctime = 0;
const FPS = 60;
let gun = [];
generate_level();
gun.push(gen_block({x: 0.03, y: -0.1, z:0.5}, 0.04, 0.1, 0.3, '#ff0000'))
gun.push(gen_block({x: 0.03, y: -0.2, z:0.5}, 0.04, 0.1, 0.5, '#ffffff'));
gun.push(gen_block({x: 0.03, y: -0.3, z:0.25}, 0.04, 0.4, 0.04, '#00ffff'));
gun = gun.map((part)=> {
    let rotated = [part.vertices[0]];
    for(let i = 1; i < part.vertices.length; i++){
        let vertex = part.vertices[i];
        rotated.push(rotate_on_y(vertex, part.vertices[0], State.gun_tilt));
    }
    return {...part, vertices: rotated};

});
State.gun = gun;
requestAnimationFrame(game_loop)

