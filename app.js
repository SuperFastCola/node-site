//http://scotch.io/tutorials/javascript/build-a-restful-api-using-node-and-express-4
//https://github.com/techpines/express.io/tree/master/examples#

var port = process.env.PORT || 3000; 		// set our port
var express = require('express');			

var cookieParser  = require('cookie-parser');
var session = require('express-session');

var app = express();			//express with Socket.io
var fs = require("fs"); 					// file system
var configLocation = __dirname + "/config.json";
var bodyParser = require('body-parser');
var path = require("path");

var tzAdjust = ((4 * 59 * 60) * 1000);


//used to buld select box in html
var statesStrings =  String("AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY");

//used to initiate cahce control on Safari blank page bug
var safari = false;

//execution of bash deploy script
//http://www.dzone.com/snippets/execute-unix-command-nodejs
var sys = require('sys');
var exec = require('child_process').exec;
var child;

var entry_uri ="/api/entry/";

app.use( bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }) ); // to support URL-encoded bodies
app.disable('etag');

//app.http().io();

//opne configuration file and store in object
var configuration = JSON.parse(fs.readFileSync(configLocation, "utf8"));
//console.log(configuration);

//http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html
var AWS = require('aws-sdk');
var awsCreds = new AWS.Credentials(configuration);
var awsConfig = new AWS.Config(awsCreds);

var dynamo_table_name = configuration.db_name;

var dynamodb = new AWS.DynamoDB(configuration);

var language = "espanol";

var htmlfiles = {
	"english":{
		"src": (__dirname + "/home.html"),
		"output":"",
		"src_rules": (__dirname + "/rules.html"), 
		"output_rules":""
	},
	"espanol":{
		"src": (__dirname + "/home-spanish.html"),
		"output":"",
		"src_rules": (__dirname + "/rules-spanish.html"), 
		"output_rules":""
	}
}

var error_messages = {
	"exists":null
};


buildStateOptions = function(htmlcode,states,separator){
	var statedata = states.split(separator);
	var optionscode = "";

	for(var i in statedata){
		optionscode += "<option value='" + statedata[i] + "'>" + statedata[i] + "</option>";
	}

	htmlcode = String(htmlcode).replace(/\[placestateabbreviation\]/,optionscode);

	return htmlcode;
}

addTimeStamp = function(htmlcode){
	var timestamp = new Date();

	var pattern = new RegExp(/\?timestamp/gi);

	htmlcode = String(htmlcode).replace(pattern,("?" + timestamp.getTime()));
	return htmlcode;
}

holdHtmlFileContent = function(filesrc,lang,outputkey){

	fs.readFile(filesrc, 'utf-8',function(err,content){
		if(err){
	    	throw new Error(err);
	  	} 
	  	else {
	  		htmlfiles[lang][outputkey] = addTimeStamp(content); 
			//htmlfiles[lang].output = buildStateOptions(content,statesStrings,"|"); 
	 	}
	});
};


/*holdHtmlFileContent(htmlfiles.english.src,"english","output");
holdHtmlFileContent(htmlfiles.espanol.src,"espanol","output");
holdHtmlFileContent(htmlfiles.english.src_rules,"english","output_rules");
holdHtmlFileContent(htmlfiles.espanol.src_rules,"espanol","output_rules");*/

//opens google tracking code and holds in variable
var google_tracking_code = "";
var facebook_sharing_code = "";

var insertcode = {
	"google":"",
	"facebook":"",
	"utm":"//no utm codes found"
}

addSocialMediaCode = function(filesrc,replacepattern,trackingkey,html_holder_key){

	var output = "--";
	var replace = replacepattern;
	var key = trackingkey;

	fs.readFile(filesrc, 'utf-8',function(err,content){
		if(err){
	    	throw new Error(err);
	  	} 
	  	else {

	  		var pat = new RegExp(replace);
	  		insertcode[html_holder_key] = String(content).replace(pat,key);
	 	}
	});
};

addSocialMediaCode((__dirname + "/google.html"),"\\[googletrackingkey\\]",configuration.google_tracking_key,"google");
addSocialMediaCode((__dirname + "/facebook.html"),"\\[facebookappid\\]",configuration.facebook_app_id,"facebook");


addSocialMediaCodeFooter = function(htmlcode,patternstring,trackingcode){
	var pattern = new RegExp("\\[" + patternstring + "\\]");

	htmlcode = String(htmlcode).replace(pattern,trackingcode);
	return htmlcode;
}

addCDNPath = function(htmlcode,cdnpath){
	var paths = new Array();
	paths.push({"pattern": new RegExp(/href="css/g), "path":"href=\"" + cdnpath + "css"});
	paths.push({"pattern": new RegExp(/src="js/g), "path":"src=\"" + cdnpath + "js"});
	paths.push({"pattern": new RegExp(/src="css/g), "path":"src=\"" + cdnpath + "css"});

	for(var i in paths){
		htmlcode = String(htmlcode).replace(paths[i].pattern,paths[i].path);		
	}

	return htmlcode;
}


outputHtmlFileContent = function(req,res,filecontent,readlocalfilepath){

	if(typeof readlocalfilepath!="undefined"){
		fs.readFile(readlocalfilepath, 'utf-8',function(err,content){
		if(err){
	    	throw new Error(err);
	  	} 
	  	else {

	  		var filecontent = addTimeStamp(content); 

	  		filecontent = addSocialMediaCodeFooter(filecontent,"googlecode",insertcode.google);
	  		filecontent = addSocialMediaCodeFooter(filecontent,"facebookcode",insertcode.facebook);
	  		filecontent = addSocialMediaCodeFooter(filecontent,"google_utm_codes",insertcode.utm);

	  		if(typeof configuration.cdn_root_path != "undefined"){
	  			filecontent = addCDNPath(filecontent,configuration.cdn_root_path);
	  		}

	  		res.set({
	  			'Content-Type': 'text/html',
	  			'Content-Length': filecontent.length
		  	});

	  		res.status(200).send(filecontent).end();

	 		}
		});
	}
	else{
		res.set({
  		'Content-Type': 'text/html',
  		'Content-Length': filecontent.length
	  	});

	  	res.status(200).send(filecontent).end();
	}

	
}


getAllData = function(req,res){
	dynamodb.scan({TableName : dynamo_table_name},function(err,data){
		if (err) {
	  		console.log(err); // an error occurred
		} 
		else {
			console.log(data);
		}
	});
}

submitEntryData = function(req,res){

	var dinfo = new Date();

	var adjustedEntryTime = new Date(dinfo.getTime() - tzAdjust);

	var dayTimeStamp = new Date(adjustedEntryTime.getFullYear(),adjustedEntryTime.getMonth(),adjustedEntryTime.getDate());
	var unixTimeHoursAndMinutes = new Date(adjustedEntryTime.getFullYear(),adjustedEntryTime.getMonth(),adjustedEntryTime.getDate(),adjustedEntryTime.getHours(),adjustedEntryTime.getMinutes());

	//get time stampe minus 4 hours
	//timestamps are in milliseconds - use http://www.epochconverter.com to check

	//construct record id from email and unixTimeStamp
	//var id = String(req.body.email.value + "-" + dayTimeStamp.getTime()).toLowerCase();

	/*var fakeadjust = dayTimeStamp.getTime() + (2 * (24 * 60 * 60) * 1000);
	dayTimeStamp = new Date(fakeadjust);*/

	var data = {
		'entry_email': {"S" : String(req.body.email.value).toLowerCase()},
		'entry_day': {"S": String(dayTimeStamp.getTime())},
		'date': {"S" : String(dayTimeStamp.getTime()) },
		'date_readable': {"S" : String(dayTimeStamp) },
		'entry_day_timestamp' : {"N": String(unixTimeHoursAndMinutes.getTime())},
		'entry_day_timestamp_readable' : {"S": String(new Date(unixTimeHoursAndMinutes))}
	};

	//clean phone value
	var phone = new RegExp(/\D/g);
	req.body.phone.value = String(req.body.phone.value).replace(phone,"");

	//get request body and add values to data object
	for(var i in req.body){

		if(String(req.body[i].value).match(/\w+/) && typeof i != "undefined" && i != "undefined"){

			if(i.match(/^(code|state)$/i)){
				req.body[i].value = String(req.body[i].value).toLowerCase();
			}

			data[i] = {"S":req.body[i].value};
		}
	}

	putDataObject(req,res,data);	
}


putDataObject = function(req,res,data,next){
	var params_put = {
		TableName : dynamo_table_name,
		Expected: {
			"entry_email": {"Exists": false},
			"entry_day": {"Exists": false}
		},
		Item : data,
		ReturnItemCollectionMetrics: 'SIZE',
		ReturnConsumedCapacity: 'INDEXES',
		ReturnValues: 'ALL_OLD'
	}

	dynamodb.putItem(params_put, function(err, data) {
		if (err) {

			console.log(err);

			if(typeof err.statusCode != "undefined"){
				switch(err.statusCode){
					case 400:
						res.status(409).send({"message":err.message});
						res.end();
					break;
				}
				
			}
			else{
				throw new Error(err);	
			}
		} 
		else {
			res.status(200).send({"message":"entered"});
			res.end();
		}

	});
}

//doesn't work without tty - comment our Defaults requiretty in /etc/sudoers - use visudo to check for syntax errors.
//use php instead
deployment = function(req,res,next){

	console.log("Match " + String(req.params.key).match(configuration.deploykey));

	if(String(req.params.key).match(configuration.deploykey) != null){
		
		var newres = res;
		var output = new Object();
		var reloadscript = __dirname + "/reload.sh update";

		child = exec(reloadscript, function (error, stdout, stderr) {

			console.log(stdout);
			console.log(stderr);
			console.log(error);

			if (String(stdout).match(/\w+/)) {
				output.out = stdout.split("\n");				
			}	

			if (String(stderr).match(/\w+/)) {
				output.err = stderr;
			}
			newres.status(200).send(output);
		});
	}
	else{
		res.send('Deployment Key Required');
	}

	//console.log(child);
}


getSpecificData = function(req,res,record_id){	
	var params_get = {
		TableName : dynamo_table_name,
		Key : { 
		  "entry_email" : {
		    "S" : record_id
		  }
		}
	}

	var newdata = record_id;
	var newreq = req;
	var newres = res;

	dynamodb.getItem(params_get, function(err, data) {
		if (err) {
		  	if(typeof err.statusCode != "undefined"){
				res.status(err.statusCode).send({"message":String(err)});
				res.end();
			}
			else{
				throw new Error(err);	
			}
		} 
		else{
			if(typeof data.Item != "undefined"){
				res.status(200).send({"message":data});
				res.end();
			}
			else{
				//res.status(204).send({"message":"no results"});
				res.end(204);
			}
		}
		//return next();
		});
}

constructErrorMessage = function(err,req,res){
	//console.log(err);

	var errorsReturned = {};

	for(var i in err){
		if(err[i].error){
			var display = ((typeof err[i].display_text != "undefined")?err[i].display_text:null);

			//is case of data-ref override
			display = ((typeof err[i].display != "undefined")?err[i].display:display);

			var message = ((typeof err[i].message != "undefined")?err[i].message:null);

			if(message!=null){

				if(String(err[i].message).match(/required|requiere/i)){

		  			if(typeof errorsReturned.required == "undefined"){
		  				errorsReturned.required = err[i].message + ": ";
		  			}

		  			errorsReturned.required += display + ", ";
	  			}
	  			else{
	  				errorsReturned[err[i].field] = ((display!=null)?display + " ":"") + err[i].message;
	  			}
		
				//errorsReturned += ((display!=null)?display + " ":"") + err[i].message + "|";
			}
		}

	}

	//remove last comma
	if(typeof errorsReturned.required != "undefined"){
		errorsReturned.required = errorsReturned.required.replace(/(,\s)$/,"");
	}
		
	res.status(406).send({"message":errorsReturned});
	res.end();
}

checkForDataErrors = function(req, res, next){

	/* VOD Codes
	1.	Obesidad - Salud
	2.	Alicia Machado - Belleza
	3.	Adicción al Sexo - Adicción
	4.	Eutanasia - Debate
	5.	Medicina Alternativa - Curación
	6.	Células Madre - Investigación
	7.	Yordano - Yordano
	8.	Pederastia - Controversia
	9.	César Millán - Perros
	10.	Patricia Velásquez - Actriz
	11.	René Pérez - Calle 13 - Residente
	12.	Muerte de Gabo - Escritor
	13.	Ricardo Arjona - Nocturno
	14.	Laura Pausini - Cantante
	15.	Raphael - Ruiseñor
	16.	El Poder de Escuchar - Entrevista a Ismael Cala - Escuchar
	17.	Inmigración en EE.UU. - Inmigración
	18.	Luis Fonsi - Fonsi
	19.	José José - Juan Pablo Montoya – Joséx2
	20.	Virginidad en el Siglo XXI –Virginidad
	*/

	var patterns = {
  		'email': new RegExp(/(\w){1,}@(\w){1,}(\.){1,}(\w){1,}/),
  		'word': new RegExp(/\w+/),
  		'state': new RegExp(String("^(" + statesStrings + ")$") ,"i"),
  		'zip': new RegExp(/[0-9]{5}/),
  		'phone': new RegExp(/[0-9]{3}.*[0-9]{3}.*[0-9]{4}/),
  		'ondemand': new RegExp(/^((Salud)|(Belleza)|(Adicci(ó|o)n)|(Debate)|(Curaci(ó|o)n)|(Investigaci(ó|o)n)|(Yordano)|(Controversia)|(Perros)|(Actriz)|(Residente)|(Escritor)|(Nocturno)|(Cantante)|(Ruise(ñ|n)or)|(Escuchar)|(Inmigraci(ó|o)n)|(Fonsi)|(Jos(é|e)x2)|(Virginidad))$/i),
  		'boolean': new RegExp(/true/)
	}

	var errors = false;
  	for(var i in req.body){
  		var reg = patterns[req.body[i].pattern];

  		//see if value matches display text
  		var display_text_pattern = new RegExp(String(req.body[i].display_text),"i");

  		//add error_messaging
  		if(String(req.body[i].pattern).match(/error/)){
  			error_messages[req.body[i].field] = req.body[i].message;
  		}

  		if(typeof reg != "undefined"){
	 		if(!reg.exec(req.body[i].value) || Boolean(display_text_pattern.exec(req.body[i].value) ) ){
	  			req.body[i].error = true;
	  			errors = true;
	  		}
	  		else{
	  			req.body[i].error = false;
	  		}
  		}

  	}

  	if(errors){
  		next(req.body);
  	}
  	else{
  		next();
  	}

}

checkForRedirect = function(req){

	if(typeof req.cookies.redirect != "undefined"){
		return true;
	}
	else{
		return Boolean(String(req.url).match(/no_redirect/i));	
	}
	
}

setRedirectCookie = function(req,res,next){

	var cookieExpiration = new Date( new Date().getTime() + ( 2 * 60 * 60 * 1000) ).toUTCString();

	//console.log(checkForRedirect(req));

	if(checkForRedirect(req)){
		if(!Boolean(req.cookies.redirect)){
			res.set('Set-Cookie','redirect=true; expires=' + cookieExpiration );
		}
	}

	next();
}


checkStartAndEndOFPromo = function(req){

	//if this is on cnn.local - localhost
	//do not adjust timezone
	if(Boolean(req.get('host').match(/^cnn\.local$/))){
		tzAdjust = 0;		
	}

	var promoStart = new Date(configuration.promo_start).getTime() - tzAdjust;
	var promoEnd = new Date(configuration.promo_end).getTime() - tzAdjust;
	var currentTime = new Date(new Date().getTime() - tzAdjust);

	// console.log("Promo Start: " + new Date(promoStart));
	// console.log("Promo End: " + new Date(promoEnd));
	// console.log("Current Time:" + currentTime);

	if(currentTime.getTime()>=promoStart && currentTime.getTime()<=promoEnd){
		configuration.closed_site = false;
	}
	else{
		configuration.closed_site = true;
	}
}


function addUTMTracking(reqObject){

	var jscode = "";

	if(typeof reqObject.utm_source != "undefined"){
		jscode += "ga('set', 'campaignName', '" + reqObject.utm_source + "');\n";
	}

	if(typeof reqObject.utm_medium != "undefined"){
		jscode += "ga('set', 'campaignMedium', '" + reqObject.utm_medium + "');\n";
	}

	if(typeof reqObject.utm_campaign != "undefined"){
		jscode += "ga('set', 'campaignSource', '" + reqObject.utm_campaign + "');\n";
	}
	
	return jscode;
}

/*checkSession = function(req,res,next){
	console.log(req.session);

	if(Boolean(String(req.url).match(/no_redirect/i))){
		req.session.override_redirect = true;
	}

	next();
}*/

app.use(cookieParser());
/*app.use(session({
	'secret':configuration.deploykey,
	'resave':true,
	'saveUninitialized':true,
	'cookie':{}
}));*/

app.use(setRedirectCookie);

//app.use(checkSession);

// middleware to use for all requests
app.use(function(req, res, next) {	
	//addressing blank page bug in Safari
	//https://coderwall.com/p/ums_lq


	insertcode.utm = addUTMTracking(req.query);

	checkStartAndEndOFPromo(req);

	var agent = req.headers['user-agent'];
	if(agent.indexOf("Safari")>-1 && agent.indexOf("Chrome")==-1 && agent.indexOf('OPR')==-1){
		res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    	res.set('Pragma', 'no-cache');
    	res.set('Expires', 0);
	}

	next(); // make sure we go to the next routes and don't stop here
});


//middleware for validating body data
app.use(entry_uri,checkForDataErrors);

//exaple of param with id
app.param('id',function(req, res, next, param){
	next();
});

//geta n app id
app.get('/api/find/:id', function(req, res, next) {
	getSpecificData(req,res,req.params.id);
});

//app.get('/api/deploy/:key', deployment);

// a convenient variable to refer to the HTML directory
/*var html_dir = './html/';

// Note: route names need not match the file name
app.get('/hello', function(req, res) {
    res.sendfile(html_dir + 'hello.html');
});*/

//tried serving html as static to fix blank page safari bug
//app.use('/html', express.static('html'));

//router for index =.html
app.get(/^\/((en|english)|(es|espanol))?(\/)?$/, function(req, res){

	//redirect trailing slash on language
	if(req.url.match(/^\/(\w+)\/$/)){
		var redirecturl = String(req.url).replace(/\/$/,"");
		res.writeHead(302, {location: redirecturl});
		res.end();
		return;
	}
	
	if(req.url.match(/(en|english)/)){
		language = "english";
	}
	else{
		language = "espanol";
	}	

	if(configuration.closed_site && !checkForRedirect(req)){
		res.end('Coming Soon');
	}
	else{
		//res.set({'Content-Type': 'text/html'});
		//res.sendFile("home.html",{root: __dirname + "/html/"});
		//res.sendFile(String(__dirname + '/html/home.html'));
		//res.sendFile(String(__dirname + '/html/home.html'));
		outputHtmlFileContent(req, res, htmlfiles[language].output,htmlfiles[language].src);
	}

	/*var options = {
	    root: __dirname + '/',
	    dotfiles: 'deny',
	    headers: {
	        'x-timestamp': Date.now(),
	        'x-sent': true
	    }
	  };
	  
	  var fileName = "home.html";

	  res.sendfile(fileName, options, function (err) {
	    if (err) {
	      console.log(err);
	      res.status(err.status).end();
	    }
	    else {
	      console.log('Sent:', fileName);
	    }
	  });*/
	
});


//router for index =.html
app.get(/^\/(reglas|rules)(\/)?/, function(req, res){

	//redirect trailing slash on language
	if(req.url.match(/^\/(\w+)\/$/)){
		var redirecturl = String(req.url).replace(/\/$/,"");
		res.writeHead(302, {location: redirecturl});
		res.end();
		return;
	}

	if(req.url.match(/rules/)){
		language = "english";
	}
	else{
		language = "espanol";
	}


	if(configuration.closed_site && !checkForRedirect(req)){
		res.end('Coming Soon');
	}
	else{
		outputHtmlFileContent(req, res, htmlfiles[language].output_rules,htmlfiles[language].src_rules);
	}
});

//display errors
app.use(function(err, req, res, next){
	
	if(typeof err != "undefined"){
		if(typeof err.message != "undefined"){
			res.status(500).send({"message":err.message});
			res.end();
		}
		else{
			//send back json object with error fields
			return constructErrorMessage(err, req, res);
		}
	}
	else{
		next()
	}
});


app.post(entry_uri,submitEntryData);

//serve the static files in the assets directory
//app.use('/assets',eio.static(__dirname + '/assets'));


app.use(function(req,res){
    res.status(404).end('Page not found!');
});

app.listen(port,function(req,res){
	console.log("Listening");
	/*child = exec("whoami", function (error, stdout, stderr) {
		console.log(stdout);
	});*/

});


