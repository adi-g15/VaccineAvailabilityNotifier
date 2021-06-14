require('dotenv').config();
const fetch = require('node-fetch');
const notifier = require('./notifier');
/**
Step 1) Enable application access on your gmail with steps given here:
 https://support.google.com/accounts/answer/185833?p=InvalidSecondFactor&visit_id=637554658548216477-2576856839&rd=1

Step 2) Enter the details in the file .env, present in the same folder

Step 3) On your terminal run: npm i && pm2 start vaccineNotifier.js

To close the app, run: pm2 stop vaccineNotifier.js && pm2 delete vaccineNotifier.js
 */

const PINCODE = process.env.PINCODE
const EMAIL = process.env.EMAIL
const AGE = process.env.AGE
const IS_FREE = true;

// SO - https://stackoverflow.com/a/31102605/12339402
function sortObjectByKeys(object) {
	return Object.keys(object).sort().reduce(
		(obj,key) => {
			obj[key] = object[key];
			return obj;
		},
		{}
	);
}

// This needs to be run every minute
async function main(){
   return checkAvailability().then(slots => {
	slots = sortObjectByKeys(slots);
	if(slots) {
		console.log("The following slots are available: ", slots);
		console.log("For dates: ", Object.keys(slots).join(', '));
		// mail in batch here
		notifyMe(slots);
	} else {
		console.log(`No ${IS_FREE ? "free": ""} vaccine available`);
	}
   });
}

function checkAvailability() {
    let datesArray = fetchNDays(5);
    let slots = {};
    let indices_checked = 0;
    return new Promise((resolve) => {
	datesArray.forEach(async (date,i) => {
        	const valid_slots = await getSlotsForDate(date);
		if( valid_slots.length > 0 ) {
			slots[date] = valid_slots;
		}

		indices_checked += 1;
		if( indices_checked === datesArray.length ) {
			resolve(slots);
		}
    	});
    });
}

function getSlotsForDate(DATE) {
    const url = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/findByPin?pincode=' + PINCODE + '&date=' + DATE;

	return fetch( url , {
		headers: {
            	'Accept': 'application/json',
            	'Accept-Language': 'hi_IN'
        	}
    	}).then(res => res.json())
	.then(slots => {
            	let validSlots = slots.sessions.filter(slot => (slot.fee_type != 'Paid' || !IS_FREE) && slot.min_age_limit <= AGE &&  slot.available_capacity > 0)
            	console.log({date:DATE, validSlots: validSlots.length})

		return validSlots;
        })
        .catch( error => {
        	console.error(error);
        	return [];
	})
}

async function notifyMe(slots){
    let slotDetails = JSON.stringify(slots, null, '\t');
    const dates = Object.keys(slots).sort().map(s => s.substr()).join(', ');
    notifier.sendEmail(EMAIL, 'VACCINE AVAILABLE - ' + dates, slotDetails, (err, result) => {
        if(err) {
            console.error({err});
        }
    })
};

function getDateString(date) {	// DD-MM-YYYY
	let str = '';
	if(date.getDate() < 10) str += '0';
	str += date.getDate();
	str += '-';
	if(date.getMonth()+1 < 10) str += '0';
	str += date.getMonth() + 1;
	str += '-';
	str += date.getFullYear();
	
	return str;
}

function fetchNDays(n){
    let dates = [];
    let today = new Date();
    for(let i = 0 ; i < n ; i ++ ){
        dates.push( getDateString(today) );
	today.setDate(today.getDate() + 1);
    }
    return dates;
}


main()
//    .then(() => {console.log('Vaccine availability checker started.');});
