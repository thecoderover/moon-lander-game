/*
 *	FILE: lander.js
 *	AUTHOR: thecoderover
 *	COPYRIGHT © 2020 thecoderover - ALL RIGHTS RESERVED
 * ---------------------------------------------------------------------------
 *	DESCRIPTION: moon lander client side game code
 * ---------------------------------------------------------------------------
 */

// Default physical constants for the game
var DEFAULT_MASS = 6000;        // Roughly based on LEM (4000 accent module + dry decent module)
var DEFAULT_FUEL = 8000;        // Fuel on the decent module
var DEFAULT_DELTA_FUEL = 8;     // HACK - how much fuel we loose each update when the engines fire
var DEFAULT_GRAVITY = 1.62;     // Acceleration of the moon
var DEFAULT_THRUST = 45000;     // 45000N as per the LEM decent module
var DEFAULT_ANGLE_LIMIT = 0.1;  // About 6 degrees
var DEFAULT_SPEED_LIMIT = 2;    // 2 m/s  ( Apollo 17 landed ~ 6.7 feet/s velocity )
var DEFAULT_SPEED = 2;          // Game speed - make for a faster 'arcade-like' game

// Default arbitrary game constants (units are metres)
var DEFAULT_DIVISIONS = 10;             // Number of divisions for the ground
var DEFAULT_LANDER_SIZE = 20;           // Size of the lander
var DEFAULT_HEIGHT_VARIATION = 100;     // Ground height variation
var DEFAULT_HEIGTH_OFFSET = 10;
var DEFAULT_COLOUR = '#000'
var DEFAULT_THICKNESS = 1;
var DEFAULT_DELAY = 2000;

// Constants
var CONST_ONE_DEGREE = Math.PI / 180;   // 1 degree in radians

// Main function - construct a new game and ui to go with it
window.onload = function() {
    var game = new Game();
    var gui = new dat.GUI();
    gui.add(game, 'message');
    var landerF = gui.addFolder('Lander Physics');
    landerF.add(game, 'gravity', 0, 10);
    landerF.add(game, 'thrust', 0, DEFAULT_THRUST * 2);
    landerF.add(game, 'fuel', 0, DEFAULT_FUEL * 2);
    landerF.add(game, 'size', 0, DEFAULT_LANDER_SIZE * 3);
    landerF.add(game, 'gamespeed', 1, DEFAULT_SPEED * 20);
    var terrainF = gui.addFolder('Terrain');
    terrainF.add(game, 'divisions', 5, 20);
    terrainF.add(game, 'groundHeight', 0, 200);
    terrainF.add(game, 'mountainHeight', 0, 200);
    var autoF = gui.addFolder('Auto Landers');
    autoF.add(game, 'landers', 0, 200);
    autoF.add(game, 'display', [ 'full', 'point', 'none' ] );
    autoF.add(game, 'deploy');
    gui.add(game, 'new game');
    gui.add(game, 'reset');
};

//
// Helper functions
//
function vectorFactory(x,y) {
    return {x: x || 0, y: y || 0};
}
//
// Display shapes; include various functionality via draw & update
//
var Point = function(x, y, thickness, colour) {
    this.draw = function(cxt) {
        cxt.beginPath();
        cxt.strokeStyle = colour || DEFAULT_COLOUR;
        cxt.lineWidth = thickness || DEFAULT_THICKNESS;
        cxt.moveTo(x, y);
        cxt.lineTo(x + 1, y);
        cxt.stroke();
    }
}

var Line = function(x1, y1, x2, y2, thickness, colour) {
    this.isPad = thickness !== 1;
    this.pointBelow = function(x, y) {
        return ((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) >= 0;
    };
    this.draw = function(cxt) {
        cxt.beginPath();
        cxt.strokeStyle = colour || DEFAULT_COLOUR;
        cxt.lineWidth = thickness || DEFAULT_THICKNESS;
        cxt.moveTo(x1, y1);
        cxt.lineTo(x2, y2);
        cxt.stroke();
    }
}

var Text = function(x, y, text, duration, colour) {
    this.draw = function(cxt) {
        cxt.beginPath();
        cxt.fillStyle = colour || DEFAULT_COLOUR;
        var metrics = cxt.measureText(text);
        cxt.fillText(text, x - metrics.width / 2, y);
        cxt.stroke();
    }
    if(duration) {
        this.expireAt = Date.now() + duration;
    }
}

var Circle = function(x, y, start, end, duration, colour, finColour) {
    var startTime = Date.now();
    this.draw = function(cxt) {
        var delta = (Date.now() - startTime) / duration;
        if(delta > 1) {
            delta = 1;
        }
        var radius = start + (end - start) * delta;  
        cxt.beginPath();
        // if(finColour) {
        //     cxt.fillStyle = lerpColour(colour, finColour, delta);
        // } else {
            cxt.fillStyle = colour || DEFAULT_COLOUR;
        //}
        cxt.arc(x, y, radius, 0, 2 * Math.PI, false);
        cxt.closePath();
        cxt.fill();
    }
    if(duration) {
        this.expireAt  = Date.now() + duration;
    }
}

// The default player controller - listens to the keyboard
var KeyController = function() {
    var self = this;
    self.keys = {
        37: 'Left',
        39: 'Right',
        38: 'Up',
        40: 'Down'
    };
    document.addEventListener('keydown', function(e) {
        if(self.keys[e.keyCode]) {
            self[self.keys[e.keyCode]] = true;
        }
    });
    document.addEventListener('keyup', function(e) {
        if(self.keys[e.keyCode]) {
            self[self.keys[e.keyCode]] = false;
        }
    });
}

// The random controller - just does anything
var RngController = function() {
    var self = this;
    self.keys = ['Down','Up','Left','Right'];
    self.update = function() {
        var key = self.keys[(Math.random() * self.keys.length) | 0];
        self[key] = self[key] ? false : true;
    }
}

//
// Main game class
//
var Game = function(Controller) {
    var self = this;

    var canvas = document.getElementById('Main');
    var context = canvas.getContext('2d');
    var player = new KeyController();

   var width = context.canvas.width;
   var height = context.canvas.height;
   var clearDraw = true;

    var centre = vectorFactory(width / 2, height / 2);

    var entities = [];  // Main game object list
  
    // exposed
    self.message = 'Moon Lander';
    self.gravity = DEFAULT_GRAVITY;
    self.thrust = DEFAULT_THRUST;
    self.fuel = DEFAULT_FUEL;
    self.gamespeed = DEFAULT_SPEED;
    self.size = DEFAULT_LANDER_SIZE;
    self.display = 'full';
    self.landers = 0;
    // maybe expose
    self.angleLimit = DEFAULT_ANGLE_LIMIT;
    self.speedLimit = DEFAULT_SPEED_LIMIT;
    self.divisions = DEFAULT_DIVISIONS;
    self.groundHeight = DEFAULT_HEIGTH_OFFSET;
    self.mountainHeight = DEFAULT_HEIGHT_VARIATION;
    self.target = centre;
    
    self['new game'] = function() {
         entities.push(new Lander({
            context: context,
            display: 'full',
            controller: player,
            pos: centre,
            fuel: self.fuel,
            gravity: self.gravity,
            thrust: self.thrust,
            gamespeed: self.gamespeed,
            size: self.size,
            angLimit: self.angleLimit,
            velLimit: self.speedLimit,
            intro: message('Press Down to start')
        }));
        ;
    };

    self.deploy = function() {
        if(self.landers) {
            for(var j = 0; j < self.landers; j++) {
                entities.push(new Lander({
                    context: context,
                    display: self.display,
                    target: self.target,
                    controller: Controller ? new Controller() : new RngController(),
                    pos: centre,
                    fuel: self.fuel,
                    gravity: self.gravity,
                    size: self.size,
                    thrust: self.thrust,
                    gamespeed: self.gamespeed,
                    angLimit: self.angleLimit,
                    velLimit: self.speedLimit
                }));
            }
        }
    }

    self.reset = function() {
        entities = [];  // Visible entities
        buildScene();
    };

    function buildScene() {
        clearDraw = self.display !== 'none';
        context.clearRect(0, 0, width, height);
        var padIndex = 1 + (Math.random() * (self.divisions - 1)) | 0;
        var y =  height - self.groundHeight;
        // We add lines first - they form the first entities and allow for a quick ground collision detection as we
        // only need to check the start of the list of collision (equal width means a lander's x position can then 
        // determine which entity needs to be checked)
        for(var i = 1, prev = {x: 0, y: y}; i <= self.divisions; i++) {
            var x = (width / self.divisions) * i;
            if(i !== padIndex) {
                y = height - self.groundHeight - Math.random() * self.mountainHeight;
            }
            var line = new Line(prev.x, prev.y, x, y, i === padIndex ? 4 : DEFAULT_THICKNESS, i === padIndex ? DEFAULT_COLOUR : '#aaa');
            if(i === padIndex) {
                self.target = vectorFactory((x - prev.x) / 2, y);
            }
            entities.push(line);
            prev.x = x;
            prev.y = y;
        }
        entities.push(new Point(centre.x, centre.y, 4));
    };

    buildScene();

    //
    // The main game loop
    // NOTE: requestAnimationFrame is generally the recommended game loop style and
    //       there are shims is older browser support if required.
    //
    (function gameLoop() {
        update();
        draw();
        window.requestAnimationFrame(gameLoop);
    })();

    //
    // Update; where we update dynamic components
    //
    function update() {
        var now = Date.now();
        var toDelete = [];
        for(var j = 0; j < entities.length; j++) {
            var entity = entities[j];
            if(entity.update !== undefined) {
                entity.update(now);
            }
            if(entity.getBounds !== undefined) {
               collide(entity);
            }
            if(entity.hasOwnProperty('expireAt') && now >= entity.expireAt) {
                toDelete.push(entity);
            }
        }
        delEntities(toDelete);
    };

    //
    // Check for collision with the ground; kill anything that goes off bounds and attempt to land everything else
    //
    function collide(entity) {
        if(entity.hasOwnProperty('expireAt')) {
            return; // Ignore entities that are about to expire.
        }
        var now = Date.now();
        var points = entity.getBounds();
        for(var i = 0; i < points.length; i++) {
            var point = points[i];
            var segment = ((self.divisions * point.x) / width) | 0;
            // Determine the ground segment we occupy and use that as an index
            // into the entity list for collision detection
            var expire;
            if(segment >= 0 && segment < self.divisions) {
                if(entities[segment].pointBelow(point.x, point.y)) {
                    if(entity.land(entities[segment])) {
                        message('Landed OK', '#0F0');
                        expire = now + DEFAULT_DELAY;
                    } else {
                        message('Crashed!', '#F00');
                        entities.push(new Circle(point.x, point.y, 5, 50, 500, "#ffeecc"));
                        expire = now;
                    }
                }
            } else{
                entity.land();
                expire = now;
                message('Offscreen!', '#F00')
            }
            if(expire) {
                entity.expireAt = expire;
                break;
            }
        }
    }

    //
    // Draw the scene
    //
    function draw() {
        if(clearDraw) {
            context.clearRect(0, 0, width, height);
        }
        if(entities.length) {
            for(var j = entities.length - 1; j >= 0; j--) {
                entities[j].draw(context);
            }
        }
    };

    //
    // Remove items from the display list
    //
    function delEntities(toDelete) {
        for(var j = 0; j < toDelete.length; j++) {
            var entity = toDelete[j];
            var index = entities.indexOf(entity);
            if(index !== -1) {
                entities.splice(index, 1);
            }
        }
    }

    //
    // Higher level draw functions; only required for drawing text which is deleted after a short time
    //
    function message(text, colour) {
        var entity = new Text(centre.x, centre.y + 20, text, DEFAULT_DELAY, colour);
        entities.push(entity);
        return entity;
    }
};

//
// The main lander class
//
var Lander = function(options) {
    var self = this;

    // Bring across the options for this lander
    var context = options.context;
    var controller = options.controller;
    var pos = options.pos;
    var fuel = options.fuel;
    var baseFuel = fuel;
    var thrust = options.thrust;
    var gravity = options.gravity;
    var display = options.display;
    var target = options.target;
    var gamespeed = options.gamespeed;
    var size = options.size;
    var velLimit = options.velLimit;
    var angLimit = options.angLimit;
    var intro = options.intro;
    var last = Date.now();
    // Things we don't bring through the options
    var dryMass = DEFAULT_MASS;

    // Define the dimensions of the lander
    var width = size * 0.75;
    var halfW = width / 2;
    var thirdW = width / 3;
    var quarterW = width / 4;
    var height = size;

    var position = vectorFactory(pos.x, pos.y);
    var velocity = vectorFactory();
    var angle = 0;
    var held = true;
    var engineOn = false;

    //
    // Draw function; 3 levels of draw (Primitive LOD)
    //
    self.draw = function() {
        context.save();
        context.translate(position.x, position.y);
        context.rotate(angle);
        context.beginPath();
        context.strokeStyle = DEFAULT_COLOUR;
        context.lineWidth = DEFAULT_THICKNESS;
        if(display === 'full') {
            const vel = velocity.x + velocity.y;
            var ang = Math.abs(angle);
            // Gauges
            if(vel > velLimit) {
                context.fillStyle = '#f00';
                context.fillRect(halfW, -height, 4, 4);
            }
            if(ang > angLimit) {
                context.fillStyle = '#f00';
                context.fillRect(-halfW - 4, -height, 4, 4);
            }
            context.strokeStyle = '#80ff80';
            context.moveTo(0, 0);
            context.lineTo(0, -height * 0.75 * fuel / baseFuel);
            context.stroke();
            // Hull
            context.strokeStyle = DEFAULT_COLOUR;
            context.moveTo(-halfW, 0);
            context.lineTo(0, -height);
            context.lineTo(halfW, 0);
            context.lineTo(-halfW, 0);
            // Legs
            context.moveTo(-halfW, 0);
            context.lineTo(0 - halfW - quarterW, thirdW);
            context.moveTo(halfW, 0);
            context.lineTo(halfW + quarterW, thirdW);
            context.stroke();
            // Flame
            if(engineOn) {
                context.beginPath();
                context.fillStyle = "#fd0";
                context.arc(0, 2, thirdW, 0, Math.PI + (Math.PI * 0) / 2, false); 
                context.closePath();
                context.fill();
            }
            context.restore();
        } else if(display === 'point') {
            context.moveTo(0, -2);
            context.lineTo(0, 0);
            context.stroke();
            if(engineOn) {
                context.strokeStyle = '#f80';
                context.moveTo(0, 1)
                context.lineTo(0, 2);
                context.stroke();
            }
            context.restore();
        } else if(display === 'none') {
            context.restore();
            context.moveTo(position.x - velocity.x,  position.y - velocity.y);
            context.lineTo(position.x, position.y);
            context.stroke();
        }
    }

    // Convert from lander coords to world coords
    function toWorld(x, y) {
        return vectorFactory(x * Math.cos(angle) - y * Math.sin(angle) + position.x,
                             x * Math.sin(angle) + y * Math.cos(angle) + position.y);
    }
    
    // The bounds of a lander are defined by a triangle; So we check those for collision
    self.getBounds = function() {
        return [toWorld(0 - halfW - quarterW, thirdW), toWorld(0, -height), toWorld(halfW + quarterW, thirdW)];
    }

    //
    // Land the lander; return true if it is has landed successfully on a pad
    //
    self.land = function(line) {
        const vel = velocity.x + velocity.y;
        var ang = Math.abs(angle);
        controller = null;
        engineOn = false;
        if(line && line.isPad && vel < velLimit && ang < angLimit) {
            return true;
        }
    }

    //
    // Update lander position
    //
    self.update = function(now)
    {
        var delta = gamespeed * (now - last) / 1000.0;
        last = now;
        if(controller && controller.update) {
            controller.update(target, position, velocity, angle, fuel);
        } 
        if(held) {
            if(controller.Down) {
                held = false;
                if(intro) {
                    intro.expireAt = 0;    // Force an early expire
                }
            } else {
                return;
            }
        }
        if(controller) {
            // Update the position
            position.x += velocity.x * delta;
            position.y += velocity.y * delta;
            // Update the acceleration
            velocity.y += gravity * delta;
            if(controller.Right && fuel)
            {   // Rotate the lander clockwise
                angle += CONST_ONE_DEGREE;
            }
            if(controller.Left && fuel)
            {   // Rotate the lander anti-clockwise
                angle -= CONST_ONE_DEGREE;
            }
            if(controller.Up && fuel)
            {   // Fire the engine
                var mass = dryMass + fuel;
                var accel = thrust * delta / mass;
                velocity.x += accel * Math.sin(angle) ;
                velocity.y -= accel * Math.cos(angle);
                engineOn = true;
                fuel = (fuel - DEFAULT_DELTA_FUEL) | 0;
            } else {
                engineOn = false;
            }
        }
    }
};