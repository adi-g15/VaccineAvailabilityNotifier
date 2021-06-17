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
const IS_DOSE_1 = true;

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
   return checkAvailability().then((slots,centers) => {
	slots = sortObjectByKeys(slots);
	if(Object.keys(slots).length !== 0) {
		console.log("The following slots are available: ", slots);
		console.log("For dates: ", Object.keys(slots).join(', '));
		// mail in batch here
		notifyMe({slots, centers});
	} else {
		console.log(`No ${IS_FREE ? "free": ""} vaccine available`);
	}
   });
}

function checkAvailability() {
    let weekStartDays = fetchNWeeks(2);
    let slots = {};
    let all_available_centers = [];
    let indices_checked = 0;
    return new Promise((resolve) => {
	weekStartDays.forEach(async (date,i) => {
        	const availableCentres = await getWeekSessionsAfterDate(date);
		
		all_available_centers = [...availableCentres];
		availableCentres.forEach( center => {
			for( let date of center.dates ) {
				if (slots[date] === undefined) {
					slots[date] = [ center ];
				}
				else slots[date] = [center, ...slots[date] ];
			}
		})

		indices_checked += 1;
		if( indices_checked === weekStartDays.length ) {
			resolve({slots, all_available_centers});
		}
    	});
    });
}

function getWeekSessionsAfterDate(DATE) {
    const url = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=' + PINCODE + '&date=' + DATE;

	return fetch( url , {
		headers: {
            	'accept': 'application/json'
        	}
    	})
	.then(res => res.json())
		.then(data => {
			//console.log(data);
			//require("process").exit(0);
			const centers = data['centers'];
		let availableCentres = [];
		for( const center of centers) {
            		let validSessions = center.sessions.filter((session) => (
				(session.fee_type != 'Paid' || !IS_FREE) &&
				session.min_age_limit <= AGE &&
				session.available_capacity > 0 &&
				(IS_DOSE_1 ? (session.available_capacity_dose1 > 0): true)	// if IS_DOSE_1 is false, shows BOTH free AND paid vaccines
			))
			let center_obj = {
				dates: validSessions.map(session => session.date),
				name: center.name,
				pincode: center.pincode,
				from: center.from,
				to: center.to,
				validSessions
			};
			if(center_obj.dates.length !== 0) {
				// available
				
				availableCentres.push(center_obj);
			}
            		// console.log({date:DATE, center: [center.name,center.pincode], duration: [center.from,center.to], validSessions: validSessions.length})
		}

		return availableCentres;
        })
/*	.then(slots => {
            	let validSlots = slots.sessions.filter(slot => (slot.fee_type != 'Paid' || !IS_FREE) && slot.min_age_limit <= AGE &&  slot.available_capacity > 0)
            	console.log({date:DATE, validSlots: validSlots.length})

		return validSlots;
        })
*/        .catch( error => {
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

function fetchNWeeks(n){
    let dates = [];
    let today = new Date();
    for(let i = 0 ; i < n ; i ++ ){
        dates.push( getDateString(today) );
	today.setDate(today.getDate() + 7);
    }
    return dates;
}


main()
//    .then(() => {console.log('Vaccine availability checker started.');});
