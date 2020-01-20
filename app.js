/*
 *	FILE: app.js
 *	AUTHOR: thecoderover
 *	COPYRIGHT © 2020 thecoderover - ALL RIGHTS RESERVED
 * ----------------------------------------------------------------------------
 *	DESCRIPTION: node server for moon lander mini project; minimal express app
 * ----------------------------------------------------------------------------
 *  Version 0.1.0: Jan 2019 - First release
 */
'use strict';
var NameString = 'MoonLander';
var VersionString = '0.1.0 Beta';

/*
 * External Module Import
 * ----------------------------------------------------------------------------
 * Import the external modules 
 */
const express = require('express');
var path = require('path');

/*
 * Internal Modules Import
 * ----------------------------------------------------------------------------
 * Import our own code
 */
const configs = require('./config');

console.log('-');
console.log(NameString + ' v' + VersionString  + ': starting in ' + __dirname);

/*
 * Express app
 * ----------------------------------------------------------------------------
 */

const app = express();

// Set path for static assets
app.use(express.static(path.join(__dirname, 'public')));

// Run the app
app.listen(configs.port);
console.log('Now Running @ ' + (new Date()));
console.log('-');