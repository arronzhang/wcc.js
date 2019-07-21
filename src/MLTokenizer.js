/**

这部分逻辑， 复用了https: //github.com/fb55/htmlparser2/blob/master/lib/Tokenizer.js
的token解析逻辑，基于有穷状态的自动机，解析token十分高效！

_emitToken：

onopentagname: 开始标签标签名
onclosetag: 结束标签标签名
onattribdata: 属性值

cbs:

ontext: 文本
onerror: 出错
onopentagend: 开始标签结束
onselfclosingtag: 自闭合的标签结束
onattribname: 属性名
onattribend: 某个属性解析完毕
oncomment: 注释
onend
onattribdata

*/
module.exports = Tokenizer;

// var decodeCodePoint = require("entities/lib/decode_codepoint.js");
// var entityMap = require("entities/maps/entities.json");
// var legacyMap = require("entities/maps/legacy.json");
// var xmlMap = require("entities/maps/xml.json");
const util = require("./util.js");
const error = require("./error.js");

var TEXT = 'TEXT';
var BEFORE_TAG_NAME = 'BEFORE_TAG_NAME'; //after <
var IN_TAG_NAME = 'IN_TAG_NAME';
var IN_SELF_CLOSING_TAG = 'IN_SELF_CLOSING_TAG';
var BEFORE_CLOSING_TAG_NAME = 'BEFORE_CLOSING_TAG_NAME';
var IN_CLOSING_TAG_NAME = 'IN_CLOSING_TAG_NAME';
var AFTER_CLOSING_TAG_NAME = 'AFTER_CLOSING_TAG_NAME';

//attributes
var BEFORE_ATTRIBUTE_NAME = 'BEFORE_ATTRIBUTE_NAME';
var IN_ATTRIBUTE_NAME = 'IN_ATTRIBUTE_NAME';
var AFTER_ATTRIBUTE_NAME = 'AFTER_ATTRIBUTE_NAME';
var BEFORE_ATTRIBUTE_VALUE = 'BEFORE_ATTRIBUTE_VALUE';
var IN_ATTRIBUTE_VALUE_DQ = 'IN_ATTRIBUTE_VALUE_DQ'; // "
var IN_ATTRIBUTE_VALUE_SQ = 'IN_ATTRIBUTE_VALUE_SQ'; // '
var IN_ATTRIBUTE_VALUE_NQ = 'IN_ATTRIBUTE_VALUE_NQ';

//declarations
var BEFORE_DECLARATION = 'BEFORE_DECLARATION'; // !
var IN_DECLARATION = 'IN_DECLARATION';

//processing instructions
var IN_PROCESSING_INSTRUCTION = 'IN_PROCESSING_INSTRUCTION'; // ?

//comments
var BEFORE_COMMENT = 'BEFORE_COMMENT';
var IN_COMMENT = 'IN_COMMENT';
var AFTER_COMMENT_1 = 'AFTER_COMMENT_1';
var AFTER_COMMENT_2 = 'AFTER_COMMENT_2';

//cdata
var BEFORE_CDATA_1 = 'BEFORE_CDATA_1'; // [
var BEFORE_CDATA_2 = 'BEFORE_CDATA_2'; // C
var BEFORE_CDATA_3 = 'BEFORE_CDATA_3'; // D
var BEFORE_CDATA_4 = 'BEFORE_CDATA_4'; // A
var BEFORE_CDATA_5 = 'BEFORE_CDATA_5'; // T
var BEFORE_CDATA_6 = 'BEFORE_CDATA_6'; // A
var IN_CDATA = 'IN_CDATA'; // [
var AFTER_CDATA_1 = 'AFTER_CDATA_1'; // ]
var AFTER_CDATA_2 = 'AFTER_CDATA_2'; // ]

//special tags
var BEFORE_SPECIAL = 'BEFORE_SPECIAL'; //S
var BEFORE_SPECIAL_END = 'BEFORE_SPECIAL_END'; //S

var BEFORE_SCRIPT_1 = 'BEFORE_SCRIPT_1'; //C
var BEFORE_SCRIPT_2 = 'BEFORE_SCRIPT_2'; //R
var BEFORE_SCRIPT_3 = 'BEFORE_SCRIPT_3'; //I
var BEFORE_SCRIPT_4 = 'BEFORE_SCRIPT_4'; //P
var BEFORE_SCRIPT_5 = 'BEFORE_SCRIPT_5'; //T
var AFTER_SCRIPT_1 = 'AFTER_SCRIPT_1'; //C
var AFTER_SCRIPT_2 = 'AFTER_SCRIPT_2'; //R
var AFTER_SCRIPT_3 = 'AFTER_SCRIPT_3'; //I
var AFTER_SCRIPT_4 = 'AFTER_SCRIPT_4'; //P
var AFTER_SCRIPT_5 = 'AFTER_SCRIPT_5'; //T

var BEFORE_STYLE_1 = 'BEFORE_STYLE_1'; //T
var BEFORE_STYLE_2 = 'BEFORE_STYLE_2'; //Y
var BEFORE_STYLE_3 = 'BEFORE_STYLE_3'; //L
var BEFORE_STYLE_4 = 'BEFORE_STYLE_4'; //E
var AFTER_STYLE_1 = 'AFTER_STYLE_1'; //T
var AFTER_STYLE_2 = 'AFTER_STYLE_2'; //Y
var AFTER_STYLE_3 = 'AFTER_STYLE_3'; //L
var AFTER_STYLE_4 = 'AFTER_STYLE_4'; //E

var BEFORE_ENTITY = 'BEFORE_ENTITY'; //&
var BEFORE_NUMERIC_ENTITY = 'BEFORE_NUMERIC_ENTITY'; //#
var IN_NAMED_ENTITY = 'IN_NAMED_ENTITY';
var IN_NUMERIC_ENTITY = 'IN_NUMERIC_ENTITY';
var IN_HEX_ENTITY = 'IN_HEX_ENTITY'; //X

var j = 0;

var SPECIAL_NONE = 'SPECIAL_NONE';
var SPECIAL_SCRIPT = 'SPECIAL_SCRIPT';
var SPECIAL_STYLE = 'SPECIAL_STYLE';

function whitespace(c) {
    return c === " " || c === "\n" || c === "\t" || c === "\f" || c === "\r";
}

const LEGAL_START = '_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');

function legalStart(c) {
    return whitespace(c) || (LEGAL_START.indexOf(c) !== -1)
}

function ifElseState(upper, SUCCESS, FAILURE) {
    var lower = upper.toLowerCase();

    if (upper === lower) {
        return function (cItem) {
            let c = cItem.c;
            if (c === lower) {
                this._state = SUCCESS;
            } else {
                this._state = FAILURE;
                this._index--;
            }
        };
    } else {
        return function (cItem) {
            let c = cItem.c;
            if (c === lower || c === upper) {
                this._state = SUCCESS;
            } else {
                this._state = FAILURE;
                this._index--;
            }
        };
    }
}

function consumeSpecialNameChar(upper, NEXT_STATE) {
    var lower = upper.toLowerCase();

    return function (cItem) {
        let c = cItem.c;
        if (c === lower || c === upper) {
            this._state = NEXT_STATE;
        } else {
            this._state = IN_TAG_NAME;
            this._index--; //consume the token again
        }
    };
}

function Tokenizer(options, cbs) {
    this._options = options;
    this._state = TEXT;
    this._buffer = [];
    this._sectionStart = 0;
    this._index = 0;
    this._bufferOffset = 0; //chars removed from _buffer
    this._baseState = TEXT;
    this._special = SPECIAL_NONE;
    this._cbs = cbs;
    this._running = true;
    this._ended = false;
    this._xmlMode = !!(options && options.xmlMode);
    this._decodeEntities = !!(options && options.decodeEntities);
}


Tokenizer.prototype.isDQ = function (index) {
    let cItem = this._buffer[index];
    let preCItem = this._buffer[index - 1];
    if (preCItem) {
        if (preCItem.c !== '\\' && cItem.c === '\"') {
            return true;
        }
    } else if (cItem.c === '\"') {
        return true;
    }
    return false;
};

Tokenizer.prototype.isSQ = function (index) {
    let cItem = this._buffer[index];
    let preCItem = this._buffer[index - 1];
    if (preCItem) {
        if (preCItem.c !== '\\' && cItem.c === '\'') {
            return true;
        }
    } else if (cItem.c === '\'') {
        return true;
    }
    return false;
};

Tokenizer.prototype._stateText = function (cItem) {
    let c = cItem.c;
    if (c === "<") {
        if (this._index > this._sectionStart) {

            this._cbs.ontext(this._getSection());
        }
        this._state = BEFORE_TAG_NAME;
        this._sectionStart = this._index;
    } else if (
        this._decodeEntities &&
        this._special === SPECIAL_NONE &&
        c === "&"
    ) {
        if (this._index > this._sectionStart) {
            this._cbs.ontext(this._getSection());
        }
        this._baseState = TEXT;
        this._state = BEFORE_ENTITY;
        this._sectionStart = this._index;
    }
};

Tokenizer.prototype._stateBeforeTagName = function (cItem) {
    let c = cItem.c;
    if (c === "/") {
        this._state = BEFORE_CLOSING_TAG_NAME;
    } else if (c === ">" || this._special !== SPECIAL_NONE) {
        this._state = TEXT;
    } else if (whitespace(c)) {
        //<空格，保持为BEFORE_TAG_NAME
    } else if (c === "!") {
        this._state = BEFORE_DECLARATION;
        this._sectionStart = this._index + 1;
    } else if (c === "?") {
        this._state = IN_PROCESSING_INSTRUCTION;
        this._sectionStart = this._index + 1;
    } else if (!legalStart(c)) {
        //开标签里面出现<或数字
        this._errored = true;
        let message = `${this._options.path}:${cItem.loc.line}:${cItem.loc.col}: unexpected character \`${c}\`\n`;
        this._cbs.onerror(
            new error.QccError(
                error.CODE.ML_PARSE.UNEXPECTED_LEFT_ANGLE_BRACKET,
                message
            )
        );
        // this._cbs.ontext(this._getSection());
        // this._sectionStart = this._index;
    } else {
        this._state = !this._xmlMode && (c === "s" || c === "S") ? BEFORE_SPECIAL : IN_TAG_NAME;
        this._sectionStart = this._index;
    }
};

Tokenizer.prototype._stateInTagName = function (cItem) {
    let c = cItem.c;
    if (c === "/" || c === ">" || whitespace(c)) {
        this._emitToken("onopentagname");
        this._state = BEFORE_ATTRIBUTE_NAME;
        this._index--;
    } else if (c === '<') {
        //标签名带了<
        this._errored = true;
        let message = `${this._options.path}:${cItem.loc.line}:${cItem.loc.col}: unexpected character \`${c}\`\n`;
        this._cbs.onerror(
            new error.QccError(
                error.CODE.ML_PARSE.UNEXPECTED_LEFT_ANGLE_BRACKET,
                message
            )
        );
    }
};

Tokenizer.prototype._stateBeforeClosingTagName = function (cItem) {
    let c = cItem.c;
    if (whitespace(c));
    else if (c === ">") {
        this._state = TEXT;
    } else if (this._special !== SPECIAL_NONE) {
        if (c === "s" || c === "S") {
            this._state = BEFORE_SPECIAL_END;
        } else {
            this._state = TEXT;
            this._index--;
        }
    } else {
        this._state = IN_CLOSING_TAG_NAME;
        this._sectionStart = this._index;
    }
};

Tokenizer.prototype._stateInClosingTagName = function (cItem) {
    let c = cItem.c;
    if (c === ">" || whitespace(c)) {
        this._emitToken("onclosetag");
        this._state = AFTER_CLOSING_TAG_NAME;
        this._index--;
    }
};

Tokenizer.prototype._stateAfterClosingTagName = function (cItem) {
    let c = cItem.c;
    //skip everything until ">"
    if (c === ">") {
        this._state = TEXT;
        this._sectionStart = this._index + 1;
    } else if (!whitespace(c)) {
        //闭合标签不能有属性
        this._errored = true;
        let message = `${this._options.path}:${cItem.loc.line}:${cItem.loc.col}: unexpected character \`${c}\`\n`;
        this._cbs.onerror(
            new error.QccError(
                error.CODE.ML_PARSE.UNEXPECTED_LEFT_ANGLE_BRACKET,
                message
            )
        );
    }
};

Tokenizer.prototype._stateBeforeAttributeName = function (cItem) {
    let c = cItem.c;
    if (c === ">") {
        this._cbs.onopentagend();
        this._state = TEXT;
        this._sectionStart = this._index + 1;
    } else if (c === "/") {
        this._state = IN_SELF_CLOSING_TAG;
    } else if (c === "\'" || c === "\"") {
        this._errored = true;
        let message = `${this._options.path}:${cItem.loc.line}:${cItem.loc.col}: unexpected attribute name, near \`${c}\`\n`;
        this._cbs.onerror(
            new error.QccError(
                error.CODE.ML_PARSE.UNEXPECTED_LEFT_ANGLE_BRACKET,
                message
            )
        );
    } else if (!legalStart(c)) {
        //开标签里面不能有<或者数字开头
        this._errored = true;
        let message = `${this._options.path}:${cItem.loc.line}:${cItem.loc.col}: unexpected character \`${c}\`\n`;
        this._cbs.onerror(
            new error.QccError(
                error.CODE.ML_PARSE.UNEXPECTED_LEFT_ANGLE_BRACKET,
                message
            )
        );
    } else if (!whitespace(c)) {
        this._state = IN_ATTRIBUTE_NAME;
        this._sectionStart = this._index;
    }
};

Tokenizer.prototype._stateInSelfClosingTag = function (cItem) {
    let c = cItem.c;
    if (c === ">") {
        this._cbs.onselfclosingtag();
        this._state = TEXT;
        this._sectionStart = this._index + 1;
    } else if (!whitespace(c)) {
        this._state = BEFORE_ATTRIBUTE_NAME;
        this._index--;
    }
};

Tokenizer.prototype._stateInAttributeName = function (cItem) {
    let c = cItem.c;
    if (c === "=" || c === "/" || c === ">" || whitespace(c)) {
        this._cbs.onattribname(this._getSection());
        this._sectionStart = -1;
        this._state = AFTER_ATTRIBUTE_NAME;
        this._index--;
    } else if (c === '<' || c === '\'' || c === '"') {
        //属性名不能有< ' "
        this._errored = true;
        let message = `${this._options.path}:${cItem.loc.line}:${cItem.loc.col}: unexpected attribute name, near \`${c}\`\n`;
        this._cbs.onerror(
            new error.QccError(
                error.CODE.ML_PARSE.UNEXPECTED_LEFT_ANGLE_BRACKET,
                message
            )
        );
    }
};

Tokenizer.prototype._stateAfterAttributeName = function (cItem) {
    let c = cItem.c;
    if (c === "=") {
        this._state = BEFORE_ATTRIBUTE_VALUE;
    } else if (c === "/" || c === ">") {
        this._cbs.onattribend();
        this._state = BEFORE_ATTRIBUTE_NAME;
        this._index--;
    } else if (!whitespace(c)) {
        this._cbs.onattribend();
        this._state = IN_ATTRIBUTE_NAME;
        this._sectionStart = this._index;
    }
};

Tokenizer.prototype._stateBeforeAttributeValue = function (cItem) {
    let c = cItem.c;
    if (c === '"') {
        this._state = IN_ATTRIBUTE_VALUE_DQ;
        this._sectionStart = this._index + 1;
    } else if (c === "'") {
        this._state = IN_ATTRIBUTE_VALUE_SQ;
        this._sectionStart = this._index + 1;
    } else if (whitespace(c)) {
        //skip whitespace
        while (whitespace(c)) {
            this._index++;
            cItem = this._buffer[this._index];
            c = cItem.c;
        }
        this._index--;
        // this._state = BEFORE_ATTRIBUTE_NAME;
    } else if (!whitespace(c)) {

        let lastCItem = this._buffer[this._index - 1];
        if (lastCItem && lastCItem.c === '=') {
            //属性值必须由"和'包起来
            this._errored = true;
            let message = `${this._options.path}:${cItem.loc.line}:${cItem.loc.col}: unexpected character \`${c}\`\n`;
            this._cbs.onerror(
                new error.QccError(
                    error.CODE.ML_PARSE.UNEXPECTED_LEFT_ANGLE_BRACKET,
                    message
                )
            );
        } else {
            this._state = BEFORE_ATTRIBUTE_NAME;
            this._index--;
            this._cbs.onattribnameNoValue();
        }

        // this._state = IN_ATTRIBUTE_VALUE_NQ;
        // this._sectionStart = this._index;
        // this._index--; //reconsume token
    }
};

Tokenizer.prototype._stateInAttributeValueDoubleQuotes = function (cItem) {
    let c = cItem.c;
    if (c === '"') {
        this._emitToken("onattribdata");
        this._cbs.onattribend();
        this._state = BEFORE_ATTRIBUTE_NAME;
    } else if (this._decodeEntities && c === "&") {
        this._emitToken("onattribdata");
        this._baseState = this._state;
        this._state = BEFORE_ENTITY;
        this._sectionStart = this._index;
    } else if (c === "\\") {
        //转义字符，跳过转移字符
        this._index++;
        if (this._index < this._buffer.length) {
            this._index++;
        }
    }
};

Tokenizer.prototype._stateInAttributeValueSingleQuotes = function (cItem) {
    let c = cItem.c;
    if (c === "'") {
        this._emitToken("onattribdata");
        this._cbs.onattribend();
        this._state = BEFORE_ATTRIBUTE_NAME;

    } else if (this._decodeEntities && c === "&") {
        this._emitToken("onattribdata");
        this._baseState = this._state;
        this._state = BEFORE_ENTITY;
        this._sectionStart = this._index;
    } else if (c === "\\") {
        //转义字符
        this._index++;
        if (this._index < this._buffer.length) {
            this._index++;
        }
    }
};

Tokenizer.prototype._stateInAttributeValueNoQuotes = function (cItem) {
    let c = cItem.c;
    if (whitespace(c) || c === ">") {
        this._emitToken("onattribdata");
        this._cbs.onattribend();
        this._state = BEFORE_ATTRIBUTE_NAME;
        this._index--;
    } else if (this._decodeEntities && c === "&") {
        this._emitToken("onattribdata");
        this._baseState = this._state;
        this._state = BEFORE_ENTITY;
        this._sectionStart = this._index;
    }
};

Tokenizer.prototype._stateBeforeDeclaration = function (cItem) {
    let c = cItem.c;
    this._state =
        c === "[" ? BEFORE_CDATA_1 : c === "-" ? BEFORE_COMMENT : IN_DECLARATION;
};

Tokenizer.prototype._stateInDeclaration = function (cItem) {
    let c = cItem.c;
    if (c === ">") {
        this._cbs.ondeclaration(this._getSection());
        this._state = TEXT;
        this._sectionStart = this._index + 1;
    }
};

Tokenizer.prototype._stateInProcessingInstruction = function (cItem) {
    let c = cItem.c;
    if (c === ">") {
        this._cbs.onprocessinginstruction(this._getSection());
        this._state = TEXT;
        this._sectionStart = this._index + 1;
    }
};

Tokenizer.prototype._stateBeforeComment = function (cItem) {
    let c = cItem.c;
    if (c === "-") {
        this._state = IN_COMMENT;
        this._sectionStart = this._index + 1;
    } else {
        this._state = IN_DECLARATION;
    }
};

Tokenizer.prototype._stateInComment = function (cItem) {
    let c = cItem.c;
    if (c === "-") this._state = AFTER_COMMENT_1;
};

Tokenizer.prototype._stateAfterComment1 = function (cItem) {
    let c = cItem.c;
    if (c === "-") {
        this._state = AFTER_COMMENT_2;
    } else {
        this._state = IN_COMMENT;
    }
};

Tokenizer.prototype._stateAfterComment2 = function (cItem) {
    let c = cItem.c;
    if (c === ">") {
        //remove 2 trailing chars
        this._cbs.oncomment(
            this._getSection({
                sectionStart: this._sectionStart,
                sectionEnd: this._index - 3
            })
        );
        this._state = TEXT;
        this._sectionStart = this._index + 1;
    } else if (c !== "-") {
        this._state = IN_COMMENT;
    }
    // else: stay in AFTER_COMMENT_2 (`--->`)
};

Tokenizer.prototype._stateBeforeCdata1 = ifElseState(
    "C",
    BEFORE_CDATA_2,
    IN_DECLARATION
);
Tokenizer.prototype._stateBeforeCdata2 = ifElseState(
    "D",
    BEFORE_CDATA_3,
    IN_DECLARATION
);
Tokenizer.prototype._stateBeforeCdata3 = ifElseState(
    "A",
    BEFORE_CDATA_4,
    IN_DECLARATION
);
Tokenizer.prototype._stateBeforeCdata4 = ifElseState(
    "T",
    BEFORE_CDATA_5,
    IN_DECLARATION
);
Tokenizer.prototype._stateBeforeCdata5 = ifElseState(
    "A",
    BEFORE_CDATA_6,
    IN_DECLARATION
);

Tokenizer.prototype._stateBeforeCdata6 = function (cItem) {
    let c = cItem.c;
    if (c === "[") {
        this._state = IN_CDATA;
        this._sectionStart = this._index + 1;
    } else {
        this._state = IN_DECLARATION;
        this._index--;
    }
};

Tokenizer.prototype._stateInCdata = function (cItem) {
    let c = cItem.c;
    if (c === "]") this._state = AFTER_CDATA_1;
};

Tokenizer.prototype._stateAfterCdata1 = function (cItem) {
    let c = cItem.c;
    if (c === "]") this._state = AFTER_CDATA_2;
    else this._state = IN_CDATA;
};

Tokenizer.prototype._stateAfterCdata2 = function (cItem) {
    let c = cItem.c;
    if (c === ">") {
        //remove 2 trailing chars
        this._cbs.oncdata(
            this._getSection({
                sectionStart: this._sectionStart,
                sectionEnd: this._index - 2
            })
        );
        this._state = TEXT;
        this._sectionStart = this._index + 1;
    } else if (c !== "]") {
        this._state = IN_CDATA;
    }
    //else: stay in AFTER_CDATA_2 (`]]]>`)
};

Tokenizer.prototype._stateBeforeSpecial = function (cItem) {
    let c = cItem.c;
    if (c === "c" || c === "C") {
        this._state = BEFORE_SCRIPT_1;
    } else if (c === "t" || c === "T") {
        this._state = BEFORE_STYLE_1;
    } else {
        this._state = IN_TAG_NAME;
        this._index--; //consume the token again
    }
};

Tokenizer.prototype._stateBeforeSpecialEnd = function (cItem) {
    let c = cItem.c;
    if (this._special === SPECIAL_SCRIPT && (c === "c" || c === "C")) {
        this._state = AFTER_SCRIPT_1;
    } else if (this._special === SPECIAL_STYLE && (c === "t" || c === "T")) {
        this._state = AFTER_STYLE_1;
    } else this._state = TEXT;
};

Tokenizer.prototype._stateBeforeScript1 = consumeSpecialNameChar(
    "R",
    BEFORE_SCRIPT_2
);
Tokenizer.prototype._stateBeforeScript2 = consumeSpecialNameChar(
    "I",
    BEFORE_SCRIPT_3
);
Tokenizer.prototype._stateBeforeScript3 = consumeSpecialNameChar(
    "P",
    BEFORE_SCRIPT_4
);
Tokenizer.prototype._stateBeforeScript4 = consumeSpecialNameChar(
    "T",
    BEFORE_SCRIPT_5
);

Tokenizer.prototype._stateBeforeScript5 = function (cItem) {
    let c = cItem.c;
    if (c === "/" || c === ">" || whitespace(c)) {
        this._special = SPECIAL_SCRIPT;
    }
    this._state = IN_TAG_NAME;
    this._index--; //consume the token again
};

Tokenizer.prototype._stateAfterScript1 = ifElseState("R", AFTER_SCRIPT_2, TEXT);
Tokenizer.prototype._stateAfterScript2 = ifElseState("I", AFTER_SCRIPT_3, TEXT);
Tokenizer.prototype._stateAfterScript3 = ifElseState("P", AFTER_SCRIPT_4, TEXT);
Tokenizer.prototype._stateAfterScript4 = ifElseState("T", AFTER_SCRIPT_5, TEXT);

Tokenizer.prototype._stateAfterScript5 = function (cItem) {
    let c = cItem.c;
    if (c === ">" || whitespace(c)) {
        this._special = SPECIAL_NONE;
        this._state = IN_CLOSING_TAG_NAME;
        this._sectionStart = this._index - 6;
        this._index--; //reconsume the token
    } else this._state = TEXT;
};

Tokenizer.prototype._stateBeforeStyle1 = consumeSpecialNameChar(
    "Y",
    BEFORE_STYLE_2
);
Tokenizer.prototype._stateBeforeStyle2 = consumeSpecialNameChar(
    "L",
    BEFORE_STYLE_3
);
Tokenizer.prototype._stateBeforeStyle3 = consumeSpecialNameChar(
    "E",
    BEFORE_STYLE_4
);

Tokenizer.prototype._stateBeforeStyle4 = function (cItem) {
    let c = cItem.c;
    if (c === "/" || c === ">" || whitespace(c)) {
        this._special = SPECIAL_STYLE;
    }
    this._state = IN_TAG_NAME;
    this._index--; //consume the token again
};

Tokenizer.prototype._stateAfterStyle1 = ifElseState("Y", AFTER_STYLE_2, TEXT);
Tokenizer.prototype._stateAfterStyle2 = ifElseState("L", AFTER_STYLE_3, TEXT);
Tokenizer.prototype._stateAfterStyle3 = ifElseState("E", AFTER_STYLE_4, TEXT);

Tokenizer.prototype._stateAfterStyle4 = function (cItem) {
    let c = cItem.c;
    if (c === ">" || whitespace(c)) {
        this._special = SPECIAL_NONE;
        this._state = IN_CLOSING_TAG_NAME;
        this._sectionStart = this._index - 5;
        this._index--; //reconsume the token
    } else this._state = TEXT;
};

Tokenizer.prototype._stateBeforeEntity = ifElseState(
    "#",
    BEFORE_NUMERIC_ENTITY,
    IN_NAMED_ENTITY
);
Tokenizer.prototype._stateBeforeNumericEntity = ifElseState(
    "X",
    IN_HEX_ENTITY,
    IN_NUMERIC_ENTITY
);

//for entities terminated with a semicolon
Tokenizer.prototype._parseNamedEntityStrict = function () {
    //offset = 1
    if (this._sectionStart + 1 < this._index) {
        var entity = this._buffer.substring(this._sectionStart + 1, this._index),
            map = this._xmlMode ? xmlMap : entityMap;

        if (map.hasOwnProperty(entity)) {
            this._emitPartial(map[entity]);
            this._sectionStart = this._index + 1;
        }
    }
};

//parses legacy entities (without trailing semicolon)
Tokenizer.prototype._parseLegacyEntity = function () {
    var start = this._sectionStart + 1,
        limit = this._index - start;

    if (limit > 6) limit = 6; //the max length of legacy entities is 6

    while (limit >= 2) {
        //the min length of legacy entities is 2
        var entity = this._buffer.substr(start, limit);

        if (legacyMap.hasOwnProperty(entity)) {
            this._emitPartial(legacyMap[entity]);
            this._sectionStart += limit + 1;
            return;
        } else {
            limit--;
        }
    }
};

Tokenizer.prototype._stateInNamedEntity = function (cItem) {
    let c = cItem.c;
    if (c === ";") {
        this._parseNamedEntityStrict();
        if (this._sectionStart + 1 < this._index && !this._xmlMode) {
            this._parseLegacyEntity();
        }
        this._state = this._baseState;
    } else if (
        (c < "a" || c > "z") &&
        (c < "A" || c > "Z") &&
        (c < "0" || c > "9")
    ) {
        if (this._xmlMode);
        else if (this._sectionStart + 1 === this._index);
        else if (this._baseState !== TEXT) {
            if (c !== "=") {
                this._parseNamedEntityStrict();
            }
        } else {
            this._parseLegacyEntity();
        }

        this._state = this._baseState;
        this._index--;
    }
};

Tokenizer.prototype._decodeNumericEntity = function (offset, base) {
    var sectionStart = this._sectionStart + offset;

    if (sectionStart !== this._index) {
        //parse entity
        var entity = this._buffer.substring(sectionStart, this._index);
        var parsed = parseInt(entity, base);

        this._emitPartial(decodeCodePoint(parsed));
        this._sectionStart = this._index;
    } else {
        this._sectionStart--;
    }

    this._state = this._baseState;
};

Tokenizer.prototype._stateInNumericEntity = function (cItem) {
    let c = cItem.c;
    if (c === ";") {
        this._decodeNumericEntity(2, 10);
        this._sectionStart++;
    } else if (c < "0" || c > "9") {
        if (!this._xmlMode) {
            this._decodeNumericEntity(2, 10);
        } else {
            this._state = this._baseState;
        }
        this._index--;
    }
};

Tokenizer.prototype._stateInHexEntity = function (cItem) {
    let c = cItem.c;
    if (c === ";") {
        this._decodeNumericEntity(3, 16);
        this._sectionStart++;
    } else if (
        (c < "a" || c > "f") &&
        (c < "A" || c > "F") &&
        (c < "0" || c > "9")
    ) {
        if (!this._xmlMode) {
            this._decodeNumericEntity(3, 16);
        } else {
            this._state = this._baseState;
        }
        this._index--;
    }
};

Tokenizer.prototype._cleanup = function () {
    if (this._sectionStart < 0) {
        this._buffer = [];
        this._bufferOffset += this._index;
        this._index = 0;
    } else if (this._running && !this._errored) {
        if (this._state === TEXT) {
            if (this._sectionStart !== this._index) {
                this._cbs.ontext(
                    this._getSection({
                        sectionStart: this._sectionStart,
                        sectionEnd: this._buffer.length - 1
                    })
                );
            }
            this._buffer = [];
            this._bufferOffset += this._index;
            this._index = 0;
        } else if (this._sectionStart === this._index) {
            //the section just started
            this._buffer = [];
            this._bufferOffset += this._index;
            this._index = 0;
        } else {

            //remove everything unnecessary
            //FIXIT _buffer
            // this._buffer = this._buffer.slice(this._sectionStart);
            // this._index -= this._sectionStart;
            // this._bufferOffset += this._sectionStart;

            let data = this._getSection({
                sectionStart: this._sectionStart,
                sectionEnd: this._buffer.length - 1
            });
            if (data.str) {
                this._errored = true;
                let message = `${this._options.path}:${data.start.loc.line}:${data.start.loc.col}: unexpected end \`${data.str}\`\n`;
                this._cbs.onerror(
                    new error.QccError(
                        error.CODE.ML_PARSE.UNEXPECTED_LEFT_ANGLE_BRACKET,
                        message
                    )
                );
            }
        }

        this._sectionStart = 0;
    }
};

//TODO make events conditional
Tokenizer.prototype.write = function (chunk = "") {
    if (this._ended) {
        this._errored = true;
        this._cbs.onerror(Error(".write() after done!"));
    }
    let baseLine = (this._buffer && this._buffer[0] && this._buffer[0].line) || 1;
    let baseCol = 1;
    let newBuffer = [];
    let beginIdx = this._buffer.length;
    for (let i = 0; i < chunk.length; ++i) {
        newBuffer.push({
            c: chunk[i],
            loc: {
                line: baseLine,
                col: baseCol
            },
            idx: beginIdx + i
        });
        if (chunk[i] === "\n") {
            baseCol = 0;
            baseLine++;
        }
        baseCol++;
    }
    this._buffer = this._buffer.concat(newBuffer);
    this._parse();
};

Tokenizer.prototype._parse = function () {

    while (this._index < this._buffer.length && this._running && !this._errored) {

        var cItem = this._buffer[this._index];
        //console.log('_state:', this._state);
        //console.log('cItem:', cItem);
        if (this._state === TEXT) {
            this._stateText(cItem);
        } else if (this._state === BEFORE_TAG_NAME) {

            this._stateBeforeTagName(cItem);
        } else if (this._state === IN_TAG_NAME) {

            this._stateInTagName(cItem);
        } else if (this._state === BEFORE_CLOSING_TAG_NAME) {

            this._stateBeforeClosingTagName(cItem);
        } else if (this._state === IN_CLOSING_TAG_NAME) {

            this._stateInClosingTagName(cItem);
        } else if (this._state === AFTER_CLOSING_TAG_NAME) {

            this._stateAfterClosingTagName(cItem);
        } else if (this._state === IN_SELF_CLOSING_TAG) {

            this._stateInSelfClosingTag(cItem);
        } else if (this._state === BEFORE_ATTRIBUTE_NAME) {

            /*
             *	attributes
             */
            this._stateBeforeAttributeName(cItem);
        } else if (this._state === IN_ATTRIBUTE_NAME) {

            this._stateInAttributeName(cItem);
        } else if (this._state === AFTER_ATTRIBUTE_NAME) {

            this._stateAfterAttributeName(cItem);
        } else if (this._state === BEFORE_ATTRIBUTE_VALUE) {

            this._stateBeforeAttributeValue(cItem);
        } else if (this._state === IN_ATTRIBUTE_VALUE_DQ) {

            this._stateInAttributeValueDoubleQuotes(cItem);
        } else if (this._state === IN_ATTRIBUTE_VALUE_SQ) {

            this._stateInAttributeValueSingleQuotes(cItem);
        } else if (this._state === IN_ATTRIBUTE_VALUE_NQ) {

            this._stateInAttributeValueNoQuotes(cItem);
        } else if (this._state === BEFORE_DECLARATION) {

            /*
             *	declarations
             */
            this._stateBeforeDeclaration(cItem);
        } else if (this._state === IN_DECLARATION) {

            this._stateInDeclaration(cItem);
        } else if (this._state === IN_PROCESSING_INSTRUCTION) {

            /*
             *	processing instructions
             */
            this._stateInProcessingInstruction(cItem);
        } else if (this._state === BEFORE_COMMENT) {

            /*
             *	comments
             */
            this._stateBeforeComment(cItem);
        } else if (this._state === IN_COMMENT) {

            this._stateInComment(cItem);
        } else if (this._state === AFTER_COMMENT_1) {
            this._stateAfterComment1(cItem);
        } else if (this._state === AFTER_COMMENT_2) {
            this._stateAfterComment2(cItem);
        } else if (this._state === BEFORE_CDATA_1) {
            /*
             *	cdata
             */
            this._stateBeforeCdata1(cItem);
        } else if (this._state === BEFORE_CDATA_2) {
            this._stateBeforeCdata2(cItem);
        } else if (this._state === BEFORE_CDATA_3) {
            this._stateBeforeCdata3(cItem);
        } else if (this._state === BEFORE_CDATA_4) {
            this._stateBeforeCdata4(cItem);
        } else if (this._state === BEFORE_CDATA_5) {
            this._stateBeforeCdata5(cItem);
        } else if (this._state === BEFORE_CDATA_6) {
            this._stateBeforeCdata6(cItem);
        } else if (this._state === IN_CDATA) {
            this._stateInCdata(cItem);
        } else if (this._state === AFTER_CDATA_1) {
            this._stateAfterCdata1(cItem);
        } else if (this._state === AFTER_CDATA_2) {
            this._stateAfterCdata2(cItem);
        } else if (this._state === BEFORE_SPECIAL) {
            /*
             * special tags
             */
            this._stateBeforeSpecial(cItem);
        } else if (this._state === BEFORE_SPECIAL_END) {
            this._stateBeforeSpecialEnd(cItem);
        } else if (this._state === BEFORE_SCRIPT_1) {
            /*
             * script
             */
            this._stateBeforeScript1(cItem);
        } else if (this._state === BEFORE_SCRIPT_2) {
            this._stateBeforeScript2(cItem);
        } else if (this._state === BEFORE_SCRIPT_3) {
            this._stateBeforeScript3(cItem);
        } else if (this._state === BEFORE_SCRIPT_4) {
            this._stateBeforeScript4(cItem);
        } else if (this._state === BEFORE_SCRIPT_5) {
            this._stateBeforeScript5(cItem);
        } else if (this._state === AFTER_SCRIPT_1) {
            this._stateAfterScript1(cItem);
        } else if (this._state === AFTER_SCRIPT_2) {
            this._stateAfterScript2(cItem);
        } else if (this._state === AFTER_SCRIPT_3) {
            this._stateAfterScript3(cItem);
        } else if (this._state === AFTER_SCRIPT_4) {
            this._stateAfterScript4(cItem);
        } else if (this._state === AFTER_SCRIPT_5) {
            this._stateAfterScript5(cItem);
        } else if (this._state === BEFORE_STYLE_1) {
            /*
             * style
             */
            this._stateBeforeStyle1(cItem);
        } else if (this._state === BEFORE_STYLE_2) {
            this._stateBeforeStyle2(cItem);
        } else if (this._state === BEFORE_STYLE_3) {
            this._stateBeforeStyle3(cItem);
        } else if (this._state === BEFORE_STYLE_4) {
            this._stateBeforeStyle4(cItem);
        } else if (this._state === AFTER_STYLE_1) {
            this._stateAfterStyle1(cItem);
        } else if (this._state === AFTER_STYLE_2) {
            this._stateAfterStyle2(cItem);
        } else if (this._state === AFTER_STYLE_3) {
            this._stateAfterStyle3(cItem);
        } else if (this._state === AFTER_STYLE_4) {
            this._stateAfterStyle4(cItem);
        } else if (this._state === BEFORE_ENTITY) {
            /*
             * entities
             */
            this._stateBeforeEntity(cItem);
        } else if (this._state === BEFORE_NUMERIC_ENTITY) {
            this._stateBeforeNumericEntity(cItem);
        } else if (this._state === IN_NAMED_ENTITY) {
            this._stateInNamedEntity(cItem);
        } else if (this._state === IN_NUMERIC_ENTITY) {
            this._stateInNumericEntity(cItem);
        } else if (this._state === IN_HEX_ENTITY) {
            this._stateInHexEntity(cItem);
        } else {
            this._errored = true;
            let message = `unknow state:${this._state}\n    at ${
        this._options.path
      }:${cItem.loc.line}:${cItem.loc.col}`;
            this._cbs.onerror(
                new error.QccError(error.CODE.ML_PARSE.UNKNOW_STATE, message)
            );
        }
        this._index++;
    }
    this._cleanup();
};

Tokenizer.prototype.pause = function () {
    this._running = false;
};
Tokenizer.prototype.resume = function () {
    this._running = true;

    if (this._index < this._buffer.length) {
        this._parse();
    }
    if (this._ended) {
        this._finish();
    }
};

Tokenizer.prototype.end = function (chunk) {
    if (this._ended) {
        this._errored = true;
        this._cbs.onerror(Error(".end() after done!"));
        return;
    }
    if (chunk) this.write(chunk);
    this._ended = true;
    if (this._running && !this._errored) this._finish();
};

Tokenizer.prototype._finish = function () {
    //if there is remaining data, emit it in a reasonable way
    if (this._sectionStart < this._index) {
        this._handleTrailingData();
    }
    this._cbs.onend();
};

Tokenizer.prototype._handleTrailingData = function () {

    let data = this._getSection({
        sectionStart: this._sectionStart,
        sectionEnd: this._buffer.length - 1
    });
    if (
        this._state === IN_CDATA ||
        this._state === AFTER_CDATA_1 ||
        this._state === AFTER_CDATA_2
    ) {
        this._cbs.oncdata(data);
    } else if (
        this._state === IN_COMMENT ||
        this._state === AFTER_COMMENT_1 ||
        this._state === AFTER_COMMENT_2
    ) {
        this._cbs.oncomment(data);
    } else if (this._state === IN_NAMED_ENTITY && !this._xmlMode) {
        this._parseLegacyEntity();
        if (this._sectionStart < this._index) {
            this._state = this._baseState;
            this._handleTrailingData();
        }
    } else if (this._state === IN_NUMERIC_ENTITY && !this._xmlMode) {
        this._decodeNumericEntity(2, 10);
        if (this._sectionStart < this._index) {
            this._state = this._baseState;
            this._handleTrailingData();
        }
    } else if (this._state === IN_HEX_ENTITY && !this._xmlMode) {
        this._decodeNumericEntity(3, 16);
        if (this._sectionStart < this._index) {
            this._state = this._baseState;
            this._handleTrailingData();
        }
    } else if (this._state === TEXT) {
        this._cbs.ontext(data);
    } else if (
        this._state !== IN_TAG_NAME &&
        this._state !== BEFORE_ATTRIBUTE_NAME &&
        this._state !== BEFORE_ATTRIBUTE_VALUE &&
        this._state !== AFTER_ATTRIBUTE_NAME &&
        this._state !== IN_ATTRIBUTE_NAME &&
        this._state !== IN_ATTRIBUTE_VALUE_SQ &&
        this._state !== IN_ATTRIBUTE_VALUE_DQ &&
        this._state !== IN_ATTRIBUTE_VALUE_NQ &&
        this._state !== IN_CLOSING_TAG_NAME
    ) {
        this._cbs.ontext(data);
    }
    //else, ignore remaining data
    //TODO add a way to remove current tag
};

Tokenizer.prototype.reset = function () {
    Tokenizer.call(
        this, {
            xmlMode: this._xmlMode,
            decodeEntities: this._decodeEntities
        },
        this._cbs
    );
};

Tokenizer.prototype.getAbsoluteIndex = function () {
    return this._bufferOffset + this._index;
};

Tokenizer.prototype._getSection = function (opts = {}) {
    let sectionStart = 0;
    let sectionEnd = 0;
    if (typeof opts.sectionStart === "undefined") {
        sectionStart = this._sectionStart;
    } else {
        sectionStart = opts.sectionStart;
    }
    if (typeof opts.sectionEnd === "undefined") {
        sectionEnd = this._index - 1;
    } else {
        sectionEnd = opts.sectionEnd;
    }
    if (sectionStart < 0) {
        sectionStart = 0;
    } else if (sectionStart >= this._buffer.length) {
        sectionStart = this._buffer.length - 1;
    }
    if (sectionEnd < 0) {
        sectionEnd = 0;
    } else if (sectionEnd >= this._buffer.length) {
        sectionEnd = this._buffer.length - 1;
    }
    let start = this._buffer[sectionStart];
    let end = this._buffer[sectionEnd];
    let setion = {
        start: start,
        end: end
    };

    if (this._buffer.length) {
        let data = [];
        for (let i = sectionStart; i <= sectionEnd; ++i) {
            data.push(this._buffer[i].c);
        }
        setion.str = data.join("");
    }

    return setion;
};

Tokenizer.prototype._emitToken = function (name) {
    this._cbs[name](this._getSection());
    this._sectionStart = -1;
};

Tokenizer.prototype._emitPartial = function (value) {
    if (this._baseState !== TEXT) {
        this._cbs.onattribdata(value); //TODO implement the new event
    } else {
        this._cbs.ontext(value);
    }
};