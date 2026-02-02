function add(number1, number2) {
	return number1 + number2;
}

function parseParameters(number1, number2) {
	const intNumber1 = parseInt(number1);
	const intNumber2 = parseInt(number2);
	if (isNaN(intNumber1)) {
		return { number1: "number1 is not in correct format" };
	}
	if (isNaN(intNumber2)) {
		return { number2: "number2 is not in correct format" };
	}
	return { number1: intNumber1, number2: intNumber2 };
}
