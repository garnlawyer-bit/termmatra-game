const divisionIds = ['one', 'two', 'three', 'four', 'five', 'six'];
const criminalPartNames = ['บทบัญญัติทั่วไป', 'ความผิด', 'ลหุโทษ'];
const criminalOffences = [
  ['1', 'ความผิดเกี่ยวกับความมั่นคงแห่งราชอาณาจักร', 107, 135, true],
  ['1/1', 'ความผิดเกี่ยวกับการก่อการร้าย', '135/1', '135/4'],
  ['2', 'ความผิดเกี่ยวกับการปกครอง', 136, 166],
  ['3', 'ความผิดเกี่ยวกับการยุติธรรม', 167, 205],
  ['4', 'ความผิดเกี่ยวกับศาสนา', 206, 208],
  ['5', 'ความผิดเกี่ยวกับความสงบสุขของประชาชน', 209, 216],
  ['6', 'ความผิดเกี่ยวกับการก่อให้เกิดภยันตรายต่อประชาชน', 217, 239],
  ['7', 'ความผิดเกี่ยวกับการปลอมและการแปลง', 240, '269/15'],
  ['8', 'ความผิดเกี่ยวกับการค้า', 270, 275],
  ['9', 'ความผิดเกี่ยวกับเพศ', 276, '287/2'],
  ['10', 'ความผิดเกี่ยวกับชีวิตและร่างกาย', 288, 308],
  ['11', 'ความผิดเกี่ยวกับเสรีภาพและชื่อเสียง', 309, 333],
  ['12', 'ความผิดเกี่ยวกับทรัพย์', 334, 366, true],
  ['13', 'ความผิดเกี่ยวกับศพ', '366/1', '366/4'],
];
const civilBooks = [
  ['หลักทั่วไป', [['ข้อความเบื้องต้น',1,3],['บทเบ็ดเสร็จทั่วไป',4,14],['บุคคล',15,136],['ทรัพย์',137,148],['นิติกรรม',149,193],['ระยะเวลา','193/1','193/8'],['อายุความ','193/9','193/35']]],
  ['หนี้', [['บทเบ็ดเสร็จทั่วไป',194,353],['สัญญา',354,394],['จัดการงานนอกสั่ง',395,405],['ลาภมิควรได้',406,419],['ละเมิด',420,452]]],
  ['เอกเทศสัญญา', [
    ['ซื้อขาย',453,517],['แลกเปลี่ยน',518,520],['ให้',521,536],['เช่าทรัพย์',537,571],['เช่าซื้อ',572,574],
    ['จ้างแรงงาน',575,586],['จ้างทำของ',587,607],['รับขน',608,639],['ยืม',640,656],['ฝากทรัพย์',657,679],
    ['ค้ำประกัน',680,701],['จำนอง',702,746],['จำนำ',747,769],['เก็บของในคลังสินค้า',770,796],
    ['ตัวแทน',797,844],['นายหน้า',845,849],['ประนีประนอมยอมความ',850,852],['การพนันและขันต่อ',853,855],
    ['บัญชีเดินสะพัด',856,860],['ประกันภัย',861,897],['ตั๋วเงิน',898,1011],['หุ้นส่วนและบริษัท',1012,'1273/4'],['สมาคม',1274,1297,true],
  ]],
  ['ทรัพย์สิน', [
    ['บทเบ็ดเสร็จทั่วไป',1298,1307],['กรรมสิทธิ์',1308,1366],['ครอบครอง',1367,1386],['ภาระจำยอม',1387,1401],
    ['อาศัย',1402,1409],['สิทธิเหนือพื้นดิน',1410,1416],['สิทธิเก็บกิน',1417,1428],['ภาระติดพันในอสังหาริมทรัพย์',1429,1434],
  ]],
  ['ครอบครัว', [['การสมรส',1435,1535],['บิดามารดากับบุตร',1536,'1598/37'],['ค่าอุปการะเลี้ยงดู','1598/38','1598/41']]],
  ['มรดก', [['บทเบ็ดเสร็จทั่วไป',1599,1619],['สิทธิโดยธรรมในการรับมรดก',1620,1645],['พินัยกรรม',1646,1710],
    ['วิธีจัดการและปันทรัพย์มรดก',1711,1752],['มรดกที่ไม่มีผู้รับ',1753,1753],['อายุความ',1754,1755]]],
];

const articleOrder = (value, atEnd = false) => {
  const [number, suffix] = String(value).replace(/[๐-๙]/gu, digit => digit.charCodeAt(0) - 0x0e50).split('/');
  return Number(number) * 1000 + (suffix === undefined && atEnd && Number(number) !== 193 ? 999 : Number(suffix ?? 0));
};

export function sectionsInScope(sections, scope) {
  if (scope.repealed) return [];
  const first = articleOrder(scope.first);
  const last = articleOrder(scope.last, !scope.exactEnd);
  return sections.filter(({ title }) => {
    const number = /^(?:มาตรา|ม\.)\s*([\d๐-๙]+(?:\/[\d๐-๙]+)?)(?![\d๐-๙/])/u.exec(title)?.[1];
    return number !== undefined && articleOrder(number) >= first && articleOrder(number) <= last;
  });
}

function subdivide(id, group, unit, numbers) {
  return numbers.map(number => {
    const book = id === 'civil' ? civilBooks[number - 1] : null;
    const bookId = id + '-' + divisionIds[number - 1];
    const name = book?.[0] ?? (id === 'criminal' ? criminalPartNames[number - 1] : undefined);
    const subTitle = unit + ' ' + number + (name ? ' ' + name : '');
    const scopes = id === 'criminal' && number === 2 ? criminalOffences.map(([number, label, first, last, exactEnd]) => ({
      id: bookId + '-title-' + number.replace('/', '-'), label: 'ลักษณะ ' + number + ' ' + label, first, last,
      ...(exactEnd && { exactEnd }),
    })) : book?.[1].map(([name, first, last, repealed], index) => {
      const titleNumber = index + (number === 1 ? 0 : 1);
      return { id: bookId + '-title-' + titleNumber, label: (titleNumber ? 'ลักษณะ ' + titleNumber + ' ' : '') + name,
        first, last, ...(repealed && { repealed }) };
    });
    return [bookId, group + ' ' + subTitle, { group, subTitle, ...(scopes && { scopes }) }];
  });
}

export const catalog = [
  ['กฎหมายสารบัญญัติ', [
    ...subdivide('criminal', 'ประมวลกฎหมายอาญา', 'ภาค', [1, 2, 3]),
    ...subdivide('civil', 'ประมวลกฎหมายแพ่งและพาณิชย์', 'บรรพ', [1, 2, 3, 4, 5, 6]),
  ]],
  ['กฎหมายวิธีพิจารณาความ', [
    ...subdivide('criminal-procedure', 'ประมวลกฎหมายวิธีพิจารณาความอาญา', 'ภาค', [1, 2, 3, 4, 6]),
    ...subdivide('civil-procedure', 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง', 'ภาค', [1, 2, 3, 4]),
    ['civil-evidence', 'พยานแพ่ง', { group: 'กฎหมายพยานหลักฐาน', subTitle: 'พยานแพ่ง' }],
    ['criminal-evidence', 'พยานอาญา', { group: 'กฎหมายพยานหลักฐาน', subTitle: 'พยานอาญา' }],
  ]],
  ['กฎหมายเฉพาะเรื่อง', [
    ['constitution', 'รัฐธรรมนูญ'],
    ['administrative-court', 'จัดตั้งศาลปกครอง'],
    ['official-tort-liability', 'ความรับผิดทางละเมิดของเจ้าหน้าที่'],
    ['administrative-procedure', 'วิธีปฏิบัติราชการทางปกครอง'],
    ['public-prosecution', 'องค์กรอัยการ'],
    ['prosecutor-commission-regulations', 'ระเบียบคณะกรรมการอัยการ'],
    ['labor', 'คุ้มครองแรงงาน'],
    ['labor-relations', 'แรงงานสัมพันธ์'],
    ['labor-court', 'จัดตั้งศาลแรงงาน'],
    ['court-constitution', 'พระธรรมนูญ'],
    ['district-court-procedure', 'วิแขวง'],
  ]],
];
const firstExample = 'สมาชิกต้องยื่นคำร้องเป็นหนังสือต่อผู้ดูแลห้องสมุด ก่อนนำหนังสือออกจากอาคาร';
export const demo = [
  { title: 'ตัวอย่าง ๑', text: firstExample, keyword: { word: 'คำร้อง', offset: firstExample.indexOf('คำร้อง') } },
  { title: 'ตัวอย่าง ๒', text: 'เมื่อได้รับแจ้งเหตุ เจ้าหน้าที่ต้องตรวจสอบรายการและบันทึกผลไว้ในสมุดประจำวัน' },
  { title: 'ตัวอย่าง ๓', text: 'คณะกรรมการอาจกำหนดระยะเวลาเพิ่มเติมได้ หากผู้สมัครมีเหตุจำเป็นและได้แจ้งล่วงหน้า' },
];
const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
const heading = /^(?:#{1,6}\s|(?:มาตรา|ข้อ|ตัวอย่าง)\s*[\d๐-๙]+(?:[/๐-๙\d]*)(?:\s+(?:ทวิ|ตรี|จัตวา))?\s*$)/u;
const numberedArticle = /^(มาตรา|ม\.|ข้อ)\s*([\d๐-๙]+(?:\s*\/\s*[\d๐-๙]+)*(?:\s*(?:ทวิ|ตรี|จัตวา|เบญจ))?)(?:\s*(\(\s*[\d๐-๙]+\s*\)))?(?=$|\s|[–—:])/u;

export function parseSections(raw) {
  const source = raw.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');
  const separator = /^\s*---[ \t]*$/mu;
  const parts = /^@คำ /mu.test(source) ? source.split(separator) : source.split(/\n[ \t]*\n|^\s*---[ \t]*$/mu);
  return parts.map(part => part.trim()).filter(Boolean)
    .map((part, index) => {
      const [first, ...lines] = part.split('\n');
      const hasTitle = lines.length > 0 && !first.startsWith('@เวลา') && (heading.test(first) || [...first].length <= 36);
      const bodyLines = hasTitle ? lines : part.split('\n');
      const timeLine = /^@เวลา(?:\s|$)/u.test(bodyLines[0]);
      const duration = timeLine ? bodyLines.shift().slice('@เวลา'.length).trim() : '';
      const seconds = timeLine ? Number(duration.replace(/[๐-๙]/gu, digit => digit.charCodeAt(0) - 0x0e50)) : undefined;
      if (timeLine && (!/^[\d๐-๙]+$/u.test(duration) || seconds < 5 || seconds > 900)) {
        fail('กำหนดเวลาด้วย @เวลา ตามด้วยจำนวนเต็ม 5–900 วินาที');
      }
      const keywordLines = [];
      while (bodyLines[0]?.startsWith('@คำ ')) keywordLines.push(bodyLines.shift().slice(4));
      const body = bodyLines.join('\n').trim();
      const keywords = keywordLines.map(line => {
        let entry;
        try { entry = JSON.parse(line); } catch {}
        const [offset, word] = Array.isArray(entry) ? entry : [];
        if (!Number.isInteger(offset) || offset < 0 || typeof word !== 'string' || !word.trim() ||
            word.length > 500 || body.slice(offset, offset + word.length) !== word) {
          fail('ตำแหน่งคีย์เวิร์ดไม่ตรงกับข้อความใน ' + first);
        }
        return { offset, word, plain: true };
      });
      const marker = /\[\[([^\s[\]]+)\]\]/u.exec(body);
      if (marker?.[1].length > 500) fail('คีย์เวิร์ดต้องยาวไม่เกิน 500 ตัวอักษร');
      return {
        title: hasTitle ? first.replace(/^#{1,6}\s+/u, '') : 'มาตรา ' + (index + 1),
        ...(hasTitle ? {} : { generatedTitle: true }),
        text: marker ? body.slice(0, marker.index) + marker[1] + body.slice(marker.index + marker[0].length) : body,
        ...(marker && { keyword: { word: marker[1], offset: marker.index } }),
        ...(keywords.length && { keywords }),
        ...(timeLine && { seconds }),
      };
    }).filter(section => section.text);
}

export function getWords(text) {
  return [...segmenter.segment(text)]
    .filter(item => item.isWordLike && /\p{L}/u.test(item.segment))
    .map(item => ({ word: item.segment, offset: item.index }));
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function canPlay(section) {
  return new Set(getWords(section.text).map(item => item.word.normalize('NFC'))).size >= 4;
}

export function sectionSeconds(section, blankCount = section.keywords?.length ?? 1) {
  const length = [...section.text.replace(/\s/gu, '')].length;
  const base = Math.max(20, Math.ceil((15 + length / 12) / 5) * 5);
  return section.seconds ?? Math.min(180, base + Math.max(0, blankCount - 1) * 8);
}

function maskedWord(word) {
  const parts = [...word.matchAll(/([ก-รลว-ฮ]|[\p{L}&&[^\p{Script=Thai}]]|\p{N})(\p{M}*)|./gsv)];
  const firstConsonant = parts.findIndex(([, base]) => /^[ก-รลว-ฮ]$/u.test(base ?? ''));
  const showConsonant = parts.some(([, base], index) => base && index !== firstConsonant);
  return parts.map(([value, base, marks], index) =>
    base && !(showConsonant && index === firstConsonant) ? { hidden: true, marks } : { text: value });
}

const thaiVowel = /[ะาำเแโใไๅฤฦัิีึืุู]/u;

function vowelHint(word) {
  return [...word.matchAll(/([^\sะาำเแโใไๅฤฦ])(\p{M}*)|./gsu)].map(([value, base, marks]) =>
    base ? { hidden: true, marks: [...marks].filter(mark => thaiVowel.test(mark)).join('') } : { text: value });
}

export function makeQuestion(section, selectedOffset, typed = false) {
  if (typed && selectedOffset === undefined && section.keywords?.length > 1) {
    let cursor = 0;
    const blanks = [];
    for (const { offset, word } of [...section.keywords].sort((a, b) => a.offset - b.offset)) {
      if (offset < cursor) continue;
      blanks.push({ before: section.text.slice(cursor, offset), hint: maskedWord(word), answer: word });
      cursor = offset + word.length;
    }
    const hardBlank = blanks.find(({ answer }) => /[ก-รลว-ฮ]/u.test(answer) && thaiVowel.test(answer)) ?? blanks[0];
    hardBlank.hint = vowelHint(hardBlank.answer);
    return { id: crypto.randomUUID(), blanks, after: section.text.slice(cursor), attempts: {}, winner: null };
  }
  const words = getWords(section.text);
  const candidates = words.filter(item => [...item.word].length >= 3);
  const choices = candidates.length ? candidates : words;
  const selected = selectedOffset === undefined
    ? (typed ? section.keywords?.[0] : undefined) ?? section.keyword ?? choices[Math.floor(Math.random() * choices.length)]
    : words.find(item => item.offset === selectedOffset);
  if (!selected) fail('กรุณาเลือกคำจากตัวบท');
  const question = {
    id: crypto.randomUUID(),
    before: section.text.slice(0, selected.offset),
    after: section.text.slice(selected.offset + selected.word.length),
    answer: selected.word,
    attempts: {},
    winner: null,
  };
  if (typed) return { ...question, phrase: selected.plain === true, hint: vowelHint(selected.word) };

  const alternatives = new Map();
  for (const item of words) {
    const canonical = item.word.normalize('NFC');
    if (canonical !== selected.word.normalize('NFC')) alternatives.set(canonical, item.word);
  }
  if (alternatives.size < 3) fail('ตัวบทต้องมีคำต่างกันอย่างน้อย 4 คำ');
  const distractors = shuffle([...alternatives.values()])
    .sort((a, b) => Math.abs(a.length - selected.word.length) - Math.abs(b.length - selected.word.length))
    .slice(0, 3);
  return { ...question, options: shuffle([selected.word, ...distractors]) };
}

export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

export function nameOf(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/gu, ' ').slice(0, 45);
}

export function createRoom({ title, sections, names, count, manual, mode, questionLimit }) {
  if (!Number.isInteger(count) || count < 1 || count > 20) fail('เลือกจำนวนผู้เล่นตั้งแต่ 1 ถึง 20 คน');
  if (!Array.isArray(names) || names.length > count) fail('กรอกรายชื่อให้ตรงกับจำนวนผู้เล่น');
  const roster = names.map(nameOf);
  if (!roster[0]) fail('กรุณากรอกชื่อเจ้าห้อง');
  const provided = roster.filter(Boolean);
  if (new Set(provided.map(name => name.normalize('NFC').toLowerCase())).size !== provided.length) {
    fail('ชื่อผู้เล่นต้องไม่ซ้ำกัน');
  }
  const typed = mode === 'type';
  if (typed && (!sections.length || !sections.every(section => section.keywords?.length || section.keyword || getWords(section.text).length))) {
    fail('แต่ละมาตราต้องมีคำสำหรับเติมอย่างน้อยหนึ่งคำ');
  }
  if (!typed && (!sections.length || !sections.every(canPlay))) fail('แต่ละมาตราต้องมีคำต่างกันอย่างน้อย 4 คำ');
  const players = Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(), token: index === 0 ? crypto.randomUUID() : null,
    name: roster[index] ?? '', score: 0,
  }));
  let questions = sections;
  if (questionLimit !== undefined) {
    if (!Number.isInteger(questionLimit) || questionLimit < 1 || questionLimit > 1500) fail('จำนวนข้อไม่ถูกต้อง');
    if (questionLimit < questions.length) questions = shuffle([...questions]).slice(0, questionLimit);
  }
  return { title, sections: questions, players, manual: manual === true, mode, phase: 'lobby', index: 0, question: null };
}

export function joinRoom(room, { slot, name }) {
  if (room.phase !== 'lobby') fail('ห้องนี้เริ่มเกมแล้ว', 409);
  const newName = nameOf(name);
  const player = slot
    ? room.players.find(item => item.id === slot)
    : room.players.find(item => !item.token && !item.name) ?? room.players.find(item => !item.token);
  if (!player || player.token) fail('ชื่อนี้ถูกเลือกแล้ว หรือห้องเต็ม', 409);
  if (!slot) {
    if (!newName) fail('กรุณากรอกชื่อ');
    if (room.players.some(item => item !== player && item.name.normalize('NFC').toLowerCase() === newName.normalize('NFC').toLowerCase())) {
      fail('ชื่อนี้อยู่ในรายชื่อแล้ว กรุณากดเลือกชื่อ');
    }
    player.name = newName;
  }
  if (!player.name) fail('กรุณากรอกชื่อ');
  player.token = crypto.randomUUID();
  return player.token;
}

function publishQuestion(room, now, offset) {
  const section = room.sections[room.index];
  const question = makeQuestion(section, offset, room.mode === 'type');
  if (room.mode === 'type' && !section.generatedTitle) {
    const article = numberedArticle.exec(section.title);
    if (article) {
      question.articleLabel = article[1] === 'ข้อ' ? 'เลขข้อ' : 'เลขมาตรา';
      question.articleNumber = article[2];
      question.articleSubsection = article[3];
    }
  }
  if (room.mode === 'type' || room.mode === 'choice') {
    question.startsAt = now + 4000;
    question.endsAt = question.startsAt + sectionSeconds(section, question.blanks?.length ?? 1) * 1000;
  }
  room.question = question;
  room.phase = 'question';
}

function openQuestion(room, now) {
  if (room.manual) {
    room.question = null;
    room.phase = 'prepare';
  } else publishQuestion(room, now);
}

function phaseAt(room, now) {
  if (room.phase !== 'question' || !room.question?.startsAt) return room.phase;
  const { startsAt, endsAt, attempts } = room.question;
  if (now < startsAt) return 'countdown';
  if (now >= endsAt || room.players.every(player => Object.hasOwn(attempts, player.id))) return 'review';
  return 'question';
}

const canonicalAnswer = word => word.trim().normalize('NFC').replace(/\u0e4d\u0e32/gu, '\u0e33');
const normalizePhrase = word => canonicalAnswer(word).replace(/\s/gu, '')
  .replace(/[๐-๙]/gu, digit => digit.charCodeAt(0) - 0x0e50);
const normalizeArticle = value => normalizePhrase(value).replace(/^(?:มาตรา|ม\.|ข้อ)/u, '');

export function act(room, token, data, now = Date.now()) {
  const player = room.players.find(item => item.token && item.token === token);
  if (!player) fail('กรุณาเข้าห้องก่อน', 403);
  const host = player === room.players[0];
  const question = room.question;
  const phase = phaseAt(room, now);
  if (data.action === 'answer') {
    if (phase === 'countdown') fail('รอให้เริ่มข้อนี้ก่อน', 409);
    if (phase !== 'question' || question.id !== data.question) fail('ข้อนี้จบแล้ว', 409);
    if (Object.hasOwn(question.attempts, player.id)) fail('คุณตอบข้อนี้แล้ว', 409);
    const validWord = word => typeof word === 'string' && word.length <= 500;
    const article = data.article ?? '';
    if (question.articleNumber && (typeof article !== 'string' || article.length > 40)) fail('เลขมาตราไม่ถูกต้อง');
    const hasArticle = question.articleNumber && Boolean(article.trim());
    const answers = data.words;
    if (question.blanks) {
      if (!Array.isArray(answers) || answers.length !== question.blanks.length ||
          !answers.every(validWord) || !(hasArticle || answers.some(word => word.trim()))) fail('กรุณาใส่คำตอบอย่างน้อยหนึ่งช่อง');
    } else if (!validWord(data.word ?? '') || !(hasArticle || data.word?.trim())) fail('กรุณาใส่คำตอบ');
    if (question.options && !question.options.includes(data.word)) fail('กรุณาเลือกคำจากตัวเลือก');
    const normalize = question.phrase || question.hint?.[0]?.plain ? normalizePhrase : canonicalAnswer;
    const wordCheck = (word, answer, normalizeWord) =>
      !word.trim() ? 'blank' : normalizeWord(word) === normalizeWord(answer) ? 'correct' : 'wrong';
    const checks = question.blanks
      ? question.blanks.map(({ answer }, index) => wordCheck(answers[index], answer, normalizePhrase))
      : [wordCheck(data.word ?? '', question.answer, normalize)];
    const keywordPoints = checks.filter(check => check === 'correct').length;
    let articlePoints = 0;
    if (hasArticle) {
      const submitted = normalizeArticle(article);
      const expected = normalizeArticle(question.articleNumber);
      if (submitted === expected ||
          (question.articleSubsection && submitted === expected + normalizeArticle(question.articleSubsection))) {
        articlePoints = 2;
      }
    }
    const points = keywordPoints + articlePoints;
    const correct = points > 0;
    question.attempts[player.id] = correct;
    question.answerChecks ??= {};
    question.answerChecks[player.id] = checks;
    if (question.articleNumber) {
      question.articleChecks ??= {};
      question.articleChecks[player.id] = !hasArticle ? 'blank' : articlePoints ? 'correct' : 'wrong';
    }
    if (question.blanks || question.hint) {
      const halfway = question.startsAt + (question.endsAt - question.startsAt) / 2;
      const speedBonus = keywordPoints === checks.length && (!question.articleNumber || articlePoints === 2) &&
        now <= halfway ? 1 : 0;
      question.points ??= {};
      question.points[player.id] = points + speedBonus;
      question.speedBonuses ??= {};
      question.speedBonuses[player.id] = speedBonus;
      if (question.articleNumber) {
        question.articlePoints ??= {};
        question.articlePoints[player.id] = articlePoints;
      }
      player.score += points + speedBonus;
      return;
    }
    if (correct && !question.winner) {
      question.winner = player.id;
      player.score++;
    }
    if (!question.endsAt && (correct || room.players.filter(item => item.token).every(item => Object.hasOwn(question.attempts, item.id)))) {
      room.phase = 'review';
    }
    return;
  }
  if (!host) fail('เฉพาะเจ้าห้องทำรายการนี้ได้', 403);
  if (data.action === 'start' && room.phase === 'lobby') {
    if (room.players.some(item => !item.token)) fail('รอให้ผู้เล่นเข้าครบตามจำนวนที่ตั้งไว้');
    openQuestion(room, now);
  } else if (data.action === 'reveal' && room.phase === 'prepare' && data.index === room.index) {
    if (!Number.isInteger(data.offset)) fail('กรุณาเลือกคำก่อน');
    publishQuestion(room, now, data.offset);
  } else if (data.action === 'next' && (phase === 'review' || (phase === 'question' && !question.endsAt)) && data.question === question.id) {
    if (++room.index === room.sections.length) {
      room.phase = 'done';
      room.question = null;
      room.sections = [];
    } else {
      openQuestion(room, now);
    }
  } else {
    fail('การเล่นเปลี่ยนสถานะแล้ว', 409);
  }
}

export function roomView(room, token, now = Date.now()) {
  const me = room.players.find(player => player.token && player.token === token);
  const host = me === room.players[0];
  const section = room.sections[room.index];
  const question = room.question;
  const phase = phaseAt(room, now);
  const review = phase === 'review';
  const pendingWinner = question?.endsAt && !review ? question.winner : null;
  const keywordScoring = Boolean(question?.hint || question?.blanks);
  const highScore = Math.max(...room.players.map(player => player.score));
  return {
    title: room.title, phase, index: room.index, serverNow: now,
    total: room.phase === 'done' ? room.index : room.sections.length,
    me: me?.id ?? null, host, manual: room.manual,
    players: room.players.map(({ id, name, score, token: key }) => ({ id, name,
      score: score - (review ? 0 : (question?.points?.[id] ?? Number(id === pendingWinner))), joined: Boolean(key) })),
    timing: me && question?.endsAt ? { startsAt: question.startsAt, endsAt: question.endsAt } : undefined,
    titleOfSection: me && phase !== 'lobby' && phase !== 'countdown' && !(question?.articleNumber && !review) ? section?.title : undefined,
    sectionTopic: me && review ? section?.topic : undefined,
    draft: host && room.phase === 'prepare' ? { text: section.text, words: getWords(section.text) } : undefined,
    question: question && me && phase !== 'countdown' ? {
      id: question.id, before: question.before, after: question.after, options: question.options, hint: question.hint,
      blanks: question.blanks?.map(({ before, hint, answer }) => ({ before, hint, answer: review ? answer : undefined })),
      submitted: Object.hasOwn(question.attempts, me.id),
      askArticle: Boolean(question.articleNumber),
      articleLabel: question.articleLabel,
      study: review ? {
        checks: question.answerChecks?.[me.id] ?? (question.blanks ?? [question]).map(() =>
          Object.hasOwn(question.attempts, me.id) ? 'unknown' : 'blank'),
        article: question.articleNumber ? {
          text: question.articleNumber + (question.articleSubsection ?? ''),
          check: question.articleChecks?.[me.id] ?? 'blank',
        } : undefined,
      } : undefined,
      articlePoints: review ? question.articlePoints?.[me.id] : undefined,
      speedBonus: review ? question.speedBonuses?.[me.id] : undefined,
      earned: keywordScoring && review ? question.points?.[me.id] : undefined,
      result: !keywordScoring || review ? question.attempts[me.id] : undefined,
      winner: pendingWinner ? null : question.winner, answer: review ? question.answer : undefined,
    } : null,
    leaders: room.phase === 'done' ? room.players.filter(player => player.score === highScore).map(player => player.name) : [],
  };
}
