/*
	Options:

	xmlMode: Disables the special behavior for script/style tags (false by default)
	lowerCaseAttributeNames: call .toLowerCase for each attribute name (true if xmlMode is `false`)
	lowerCaseTags: call .toLowerCase for each tag name (true if xmlMode is `false`)
*/

/*
	Callbacks:

	oncdataend,
	oncdatastart,
	onclosetag,
	oncomment,
	oncommentend,
	onerror,
	onopentag,
	onprocessinginstruction,
	onreset,
	ontext
*/
const Tokenizer = require("./MLTokenizer.js");
const error = require('./error.js');
const util = require('./util.js');

function Parser(cbs = {}, options = {}) {
	options = Object.assign({
		path: 'unknow path'
	}, options);
	this._options = options;
	this._cbs = Object.assign({
		onerror: util.NOOP,
		onend: util.NOOP
	}, cbs);
	this._tokenizer = new Tokenizer(this._options, this);
	this._root = {
		type: 'root',
		children: [],
		path: options.path
	};
	this._stack = [this._root];
	this._error = null;
}

Parser.prototype.ontext = function (data) {
	if(!data.str.trim()){
		return;
	}
	if(this._error){
		return;
	}
	let node = {
		type: 'text',
		value: data
	}
	let parentNode = this._stack[this._stack.length - 1];
	parentNode.children.push(node);
};

Parser.prototype.onopentagname = function (name) {
	
	if(this._error){
		return;
	}
	// console.log('onopentagname:', name);
	let parentNode = this._stack[this._stack.length - 1];
	let node = {
		type: 'tag',
		openTag: name,
		attributes: [],
		children: []
	};
	parentNode.children.push(node);
	this._stack.push(node);
};

Parser.prototype.onopentagend = function () {
	//ignore
};

Parser.prototype.onclosetag = function (name) {
	
	if(this._error){
		return;
	}
	// console.log('onclosetag:', name);
	let top = this._stack[this._stack.length - 1];
	if (top.openTag.str !== name.str) {
		this._error = new error.QccError(-1, `${this._options.path}:${name.start.loc.line}:${name.start.loc.col}: expect end-tag \`${top.openTag.str}\`., near \`${name.str}\`\n`);
		this.onerror(this._error);
		return;
	}

	top.closeTag = name;
	this._stack.pop();
};

Parser.prototype.onselfclosingtag = function () {
	if(this._error){
		return;
	}
	// console.log('onselfclosingtag')
	this._stack.pop();
};


Parser.prototype.onattribname = function (name) {
	if(this._error){
		return;
	}
	let node = this._stack[this._stack.length - 1];
	let attributeNode = {
		type: 'attribute',
		name: name
	}
	node.attributes.push(attributeNode);
};

Parser.prototype.onattribdata = function (value) {
	if(this._error){
		return;
	}
	let node = this._stack[this._stack.length - 1];
	node.attributes[node.attributes.length - 1].value = value;
};

Parser.prototype.onattribnameNoValue = function(){
	let node = this._stack[this._stack.length - 1];
	node.attributes.pop();
};

Parser.prototype.onattribend = function () {
	// console.log('onattribend')
	if(this._error){
		return;
	}
	//ignore
};

Parser.prototype.oncomment = function (value) {
	if(this._error){
		return;
	}
	//ignore
};

Parser.prototype.onerror = function (err) {
	this._cbs.onerror(err);
};


Parser.prototype.onend = function () {
	if(this._stack.length > 1){
		let top = this._stack[this._stack.length - 1];
		this._error = new error.QccError(-1, `${this._options.path}:${top.openTag.start.loc.line}:${top.openTag.start.loc.col}: end tag missing, near \`${top.openTag.str}\`\n`);
		this.onerror(this._error);
		return;
	}
	this._cbs.onend(this._root);
};

Parser.prototype.parseComplete = function () {
	if(this._error){
		return;
	}
};

Parser.prototype.write = function (chunk) {
	if(this._error){
		return;
	}
	this._tokenizer.write(chunk);
};

Parser.prototype.end = function (chunk) {
	if(this._error){
		return;
	}
	this._tokenizer.end(chunk);
};

Parser.prototype.pause = function () {
	if(this._error){
		return;
	}
	this._tokenizer.pause();
};

Parser.prototype.resume = function () {
	if(this._error){
		return;
	}
	this._tokenizer.resume();
};

module.exports = Parser;