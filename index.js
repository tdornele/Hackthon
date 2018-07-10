var express  = require('express');
var fs       = require('fs');
var jsonfile = require('jsonfile');
var file     = 'data.json'
var app      = express();
var n        = 100;
var cors     = require('cors');
app.use(cors());

app.get('/', function (req, res) {
	var ema = require('exponential-moving-average');
	var values;

	var content;
	jsonfile.readFile(file, (err, data) => {
		if (err) {
			throw err;
		}
		content = data;
		values  = content.map((data) => {
			return data['aggr']['sum'] / data['aggr']['count']['$numberLong']
		})

		var firstList  = ema(values, n).map(x => x * 3);
		var secondList = ema(ema(values, n), n).map(x => x * 3);
		var thirdList  = ema(ema(ema(values, n), n), n);

		//var equation = firstList.map((x, key) => {
		//	return x - secondList[key] + (thirdList[key] || 0);
		//});
		//console.log(equation);

		var emaValue = [...Array(100).keys()].map(() => null).concat(ema(values, n));

		var emsList = emaValue.map((x, key) => ems(x, emsList, content[key]));

		var highEMS = values.map((x, key) => x + emsList[key]);
		var lowEMS  = values.map((x, key) => x - emsList[key]);
		var allEMS  = highEMS.map((x, key) => {
			return [x, lowEMS[key]]
		});
		//console.log(allEMS);
		for (var index in values){
			getAnomalies(values[index], emaValue[index], emsList[index]);
		}

		res.send({
			data   : values,
			ema    : emaValue,
			allEMS : allEMS
		});
	})
})

app.listen(3000, function () {
	console.log('Server listening')
	//readingData()
})

function ems(ema, preEMS, value) {
	var w = 2 / (n + 1);
	return Math.sqrt(w * (preEMS ^ 2) + (1 - w) * ((value + ema) ^ 2));
}

function getAnomalies(value, emaValue, emsList) {
	var difference = value - emaValue;
	if (difference < 0) {
		difference *= -1;
	}
	var sensitivity = n * emsList;

	// Testing to see what values show up
	console.log('\n\nTEST!');
	console.log('Value: ' + value);
	console.log('emaValue: ' + emaValue);
	console.log('Diff: ' + difference);
	console.log('Sens: ' + sensitivity);

	var amount = 0;
	if (difference > sensitivity) {
		//return "ALARM!";
		console.log("ALARM!!!!!!" + amount);
		amount++;
	}
}