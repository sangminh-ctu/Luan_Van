const MAX_BOOKS = 3;
const MAX_CATALOG_PAGES = 3;

const digits = new Map(Object.entries({
    khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9,
}));

function normalize(value) {
    return String(value || '').toLowerCase().normalize('NFD')
        .replace(/\p{M}/gu, '').replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeTone(value) {
    return String(value || '').toLowerCase().normalize('NFC')
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function baseTitle(title) {
    return String(title || '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s*\[[^\]]*\]\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function shortText(value, length) {
    return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

function shortList(value, length, count) {
    return Array.isArray(value) ? value.slice(0, count).map(item => shortText(item, length)).filter(Boolean) : [];
}

function bookIds(value) {
    return Array.isArray(value) ? value.filter(id => Number.isSafeInteger(id) && id > 0).slice(0, MAX_BOOKS) : [];
}

function validPrice(price) {
    return Number.isSafeInteger(price) && price >= 0 && price <= 1000000000;
}

function findMention(items, idKey, nameKey, question) {
    return items.filter(item => {
        const name = normalize(item[nameKey]);
        return name && ` ${question} `.includes(` ${name} `);
    }).sort((a, b) => b[nameKey].length - a[nameKey].length)[0]?.[idKey];
}

function readGroup(words) {
    let total = 0;
    if (words[1] === 'tram' && digits.has(words[0])) {
        total = 100 * digits.get(words[0]);
        words = words.slice(2);
    }
    if (!words.length) return total;
    if (words[0] === 'le' || words[0] === 'linh') words = words.slice(1);
    if (words[0] === 'muoi') {
        total += 10;
        words = words.slice(1);
    } else if (words[1] === 'muoi' && digits.has(words[0])) {
        total += 10 * digits.get(words[0]);
        words = words.slice(2);
    }
    if (!words.length) return total;
    return words.length === 1 && digits.has(words[0]) ? total + digits.get(words[0]) : undefined;
}

function readAmount(text) {
    const numeric = text.match(/^(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)[ \t]*(nghin|ngan|k|trieu|dong|d)?(?=\W|$)/);
    if (numeric) {
        const [, amount, unit] = numeric;
        const multiplier = unit === 'trieu' ? 1000000 : ['k', 'nghin', 'ngan'].includes(unit) ? 1000 : 1;
        const grouped = multiplier === 1 && /^\d{1,3}(?:[.,]\d{3})+$/.test(amount);
        return Number(grouped ? amount.replace(/[.,]/g, '') : amount.replace(',', '.')) * multiplier;
    }

    const words = text.split(/[^a-z]+/);
    let group = [];
    let total = 0;
    let lastScale = Infinity;
    for (const word of words) {
        const scale = word === 'trieu' ? 1000000 : ['nghin', 'ngan'].includes(word) ? 1000 : null;
        if (scale) {
            const value = group.length ? readGroup(group) : undefined;
            if (value === undefined || scale >= lastScale) return undefined;
            total += value * scale;
            lastScale = scale;
            group = [];
        } else if (digits.has(word) || ['tram', 'muoi', 'le', 'linh'].includes(word)) {
            group.push(word);
        } else {
            break;
        }
    }
    if (lastScale === Infinity && !group.length) return undefined;
    const tail = readGroup(group);
    return tail === undefined ? undefined : total + tail;
}

function readBudget(message) {
    const text = String(message || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
        .replace(/đ/g, 'd').replace(/\s+/g, ' ');
    const range = text.match(/\btu\s+(.+?)\s+(?:den|toi)\s+(.+)/);
    if (range) {
        const minPrice = readAmount(range[1]);
        const maxPrice = readAmount(range[2]);
        if (Number.isSafeInteger(minPrice) && Number.isSafeInteger(maxPrice)) {
            return minPrice >= 0 && minPrice <= maxPrice ? { minPrice, maxPrice } : { unclear: true };
        }
    }
    const match = text.match(/\b(duoi|toi da|khong qua|ngan sach(?: la)?|tam|(?:tang|nang)(?: ngan sach)? len)[ \t]*[:=]?[ \t]+(.*)/);
    if (!match) {
        const availableMoney = text.match(/^(?:(?:minh|toi|em)\s+)?(?:chi\s+)?co\s+(.+?(?:nghin|ngan|trieu|dong|k|d))\b/);
        if (!availableMoney) return {};
        const value = readAmount(availableMoney[1]);
        return Number.isSafeInteger(value) && value >= 0 ? { maxPrice: value, strict: false } : {};
    }
    const [, comparison, amount] = match;
    const value = readAmount(amount);
    if (Number.isSafeInteger(value) && value >= 0) {
        const strict = comparison === 'duoi';
        return { maxPrice: value - Number(strict), strict };
    }
    return { unclear: comparison !== 'tam' };
}

const stopWords = new Set('toi minh muon tim mua sach cuon nao co cho goi y khong duoi toi da tam ngan chi phi cua ve giup mot nhung the loai re hon tram muoi nghin trieu dong hai ba bon nam sau bay chin doi sang bo gioi han bao nhieu tien dang'.split(' '));
const toneStopPattern = /(?<!\p{L})(?:giá(?:\s+bán|\s+cả|\s+tiền)?|tồn\s+kho|còn\s+hàng|hết\s+hàng)(?!\p{L})/giu;
const preferencePattern = /\b(de doc|de tang(?: ban)?|nhe nhang|it bao luc)\b/g;
const clearPricePattern = /\b(bo (?:gioi han gia|ngan sach)|khong gioi han (?:gia|ngan sach)|gia nao cung duoc)\b/;
const discountPattern = /\b(dang giam gia|giam gia|khuyen mai|flash sale|sale|uu dai|dang giam)\b/g;
const regularPricePattern = /\b(khong (?:dang )?giam gia|khong (?:co )?khuyen mai)\b/;
const anyDiscountPattern = /\b((?:co )?giam(?: gia)? (?:hay|hoac) khong (?:cung duoc|deu duoc)|(?:khong (?:can|bat buoc)|bo (?:dieu kien|bo loc)) (?:dang )?(?:giam gia|khuyen mai)|gia thuong (?:hay|hoac) giam gia deu duoc)\b/;
const greetingPattern = /^(?:(?:xin )?chao|hello|hi|hey|alo|helo)(?: (?:ban|shop|em|anh|chi|ad|admin|misa|bot|oi|nhe|a|buoi (?:sang|trua|chieu|toi)))*$/;
const thanksPattern = /^(?:ok |vang |da )?(?:cam on|thanks|thank you|thank|tks)(?: (?:ban|shop|em|nhieu|nhe|nha|a))*$/;
const goodbyePattern = /^(?:tam biet|bye|bai bai|hen gap lai)(?: (?:ban|shop|nhe|nha|a))*$/;
const policyPattern = /\b(doi tra|hoan tien|van chuyen|giao hang|phi ship|ship|don hang|chinh sach|bao hanh|thanh toan|tra gop|huy don)\b/;
const ordinalPattern = /\b(?:cuon|quyen|sach|ban|phien ban)\s+(?:so\s+)?(?:thu\s+)?(nhat|dau tien|dau|hai|ba|1|2|3|cuoi cung|cuoi)\b/;
const ordinalWords = { nhat: 1, 'dau tien': 1, dau: 1, 1: 1, hai: 2, 2: 2, ba: 3, 3: 3 };
const contextRefPattern = /\b(?:cuon|quyen|sach|ban)\s+(?:nay|do|ay|vua roi|tren)\b/;

function extractKeywords(value) {
    const cleaned = String(value || '').replace(toneStopPattern, ' ');
    return [...new Set(normalize(cleaned).replace(preferencePattern, ' ').replace(discountPattern, ' ').split(' '))]
        .filter(word => /^[a-z]{2,30}$/.test(word) && !stopWords.has(word)).slice(0, 20);
}

function isBudgetBrowse(message, budget = readBudget(message)) {
    if (budget.maxPrice === undefined) return false;
    const question = normalize(String(message).replace(toneStopPattern, ' '));
    if (!/\b(sach|cuon)\b/.test(question)) return false;
    const request = question.replace(/^(minh|toi|em)\s+/, '').replace(/\bsach ao$/, 'sach nao')
        .replace(/\b(mua duoc|co the|khong qua)\b/g, ' ')
        .replace(/\b(tu|den)\b/g, ' ');
    return !/\b(giam|khuyen mai|sale|uu dai)\b/.test(request) && extractKeywords(request).length === 0;
}

function cleanExtractedTitle(raw) {
    if (!raw) return '';
    let text = String(raw).trim()
        .replace(/^["“'‘]+|["”'’?!.,;:]+$/g, '')
        .replace(/^(?:(?:của|cua)\s+)?(?:cuốn\s+sách|cuon\s+sach|quyển\s+sách|quyen\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen|tác\s+phẩm|tac\s+pham)\s+/iu, '')
        .replace(/\s+(?:(?:là|la)\s+bao\s+(?:nhiêu|nhieu)|bao\s+(?:nhiêu|nhieu)\s+(?:tiền|tien)|bao\s+(?:nhiêu|nhieu)|(?:giá|gia)\s+bao\s+(?:nhiêu|nhieu)|(?:còn|con)\s+(?:hàng|hang)\s+(?:không|khong)|(?:còn|con)\s+(?:không|khong)|(?:hết|het)\s+(?:hàng|hang)\s+(?:chưa|chua)|(?:là|la)\s+ai|(?:nói|noi|viết|viet|kể|ke)\s+(?:về|ve)\s+(?:cái\s+)?(?:gì|gi)|(?:thuộc|thuoc)\s+(?:thể\s+loại|the\s+loai)\s+(?:gì|gi|nào|nao)|(?:được\s+)?(?:đánh\s+giá|danh\s+gia)\s+(?:mấy|may|bao\s+nhiêu|bao\s+nhieu)\s+sao|(?:có|co)\s+hay\s+(?:không|khong)|(?:vậy|vay)\s+shop|(?:vậy|vay)\s+ạ|(?:vậy|vay)|nhỉ|nhi|nhé|nhe|ạ|a|không|khong)$/iu, '')
        .replace(/^["“'‘]+|["”'’?!.,;:]+$/g, '')
        .trim();
    const norm = normalize(text);
    if (!norm || /^(nay|do|ay|vua roi|tren|nao|gi)$/.test(norm)
        || contextRefPattern.test(norm) || ordinalPattern.test(`cuon ${norm}`) || ordinalPattern.test(norm)) {
        return '';
    }
    return shortText(text, 150);
}

function parseSpecificQuery(message, question) {
    const text = String(message || '').trim().replace(/[?!.]+$/g, '').trim();
    const quoted = text.match(/["“]([^"”]{1,150})["”]/);

    // 1. Similar books recommendation
    const similarMatch = text.match(/(?:sách|sach|cuốn|cuon|quyển|quyen|truyện|truyen)\s+(?:(?:nào|nao)\s+)?(?:giống|giong|tương\s+tự|tuong\s+tu)(?:\s+(?:với|voi|như|nhu))?\s+(?:(?:cuốn|cuon|quyển|quyen|sách|sach)\s+)?(.+?)(?:\s+(?:không|khong|nhỉ|nhi|nhé|nhe|ạ|a))?$/iu)
        || text.match(/^(?:gợi\s+ý|goi\s+y|tìm|tim)(?:\s+cho\s+(?:mình|minh))?\s+(?:sách|sach|cuốn|cuon|truyện|truyen)\s+(?:giống|giong|tương\s+tự|tuong\s+tu)\s+(.+?)(?:\s+(?:không|khong|nhé|nhe))?$/iu);
    if (similarMatch) {
        const similarToTitle = cleanExtractedTitle(quoted?.[1] || similarMatch[1]);
        if (similarToTitle) return { intent: 'book_recommendation', similarToTitle };
    }

    // 2. Stock inquiry
    const asksStock = /\b(con hang|het hang|ton kho|con sach|con cuon|con quyen|co san)\b/.test(question)
        || /\bcon\s+khong\b/.test(question);
    if (asksStock) {
        const m1 = text.match(/^(?:cho\s+(?:mình|minh|tôi|toi)\s+(?:hỏi|hoi)\s+)?(?:(?:hiện|hien)\s+)?(?:cuốn\s+sách|cuon\s+sach|quyển\s+sách|quyen\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)\s+(?:(?:hiện|hien)\s+)?(?:(?:còn|con)\s+(?:hàng|hang|trong\s+kho|sách|sach|không|khong|bao\s+nhiêu|bao\s+nhieu)|(?:hết|het)\s+(?:hàng|hang)|(?:có|co)\s+(?:sẵn|san))/iu);
        const m2 = text.match(/(?:kiểm\s+tra\s+tồn\s+kho|kiem\s+tra\s+ton\s+kho|tồn\s+kho|ton\s+kho|(?:còn|con)\s+(?:sách|sach|cuốn|cuon|quyển|quyen))\s+(?:(?:của|cua)\s+)?(?:(?:cuốn|cuon|quyển|quyen|sách|sach)\s+)?(.+?)(?:\s+(?:không|khong|bao\s+nhiêu|bao\s+nhieu|nhé|nhe|ạ|a))?$/iu);
        const title = cleanExtractedTitle(quoted?.[1] || m1?.[1] || m2?.[1]);
        return { intent: 'book_stock', title };
    }

    // 3. Price inquiry
    const hasBudgetFilter = readBudget(message).maxPrice !== undefined
        || /\b(duoi|toi da|khong qua|ngan sach|re hon)\b/.test(question);
    const asksPrice = !hasBudgetFilter && (
        /(?<!\p{L})giá(?:\s+bán|\s+tiền|\s+của|\s+cuốn|\s+quyển|\s+sách)(?!\p{L})/iu.test(text)
        || /\bgia\s+(?:ban\s+|tien\s+)?(?:cua\s+)?(?:cuon|quyen|sach)\b/.test(question)
        || /\b(?:gia\s+bao\s+nhieu|bao\s+nhieu\s+tien)\b/.test(question)
        || /^(?:giá|gia)\s+/iu.test(text)
    );
    if (asksPrice) {
        const m1 = text.match(/(?:giá|gia)(?:\s+(?:bán|ban|tiền|tien))?\s+(?:(?:của|cua)\s+)?(?:cuốn\s+sách|cuon\s+sach|quyển\s+sách|quyen\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)\s+(.+?)(?:\s+(?:(?:là|la)\s+)?bao\s+(?:nhiêu|nhieu)(?:\s+(?:tiền|tien))?|\s+(?:vậy|vay|nhỉ|nhi|ạ|a))?$/iu);
        const m2 = text.match(/(?:giá|gia)(?:\s+(?:bán|ban|tiền|tien))?\s+(?:(?:của|cua)\s+)?(.+?)(?:\s+(?:(?:là|la)\s+)?bao\s+(?:nhiêu|nhieu)(?:\s+(?:tiền|tien))?|\s+(?:vậy|vay|nhỉ|nhi|ạ|a))?$/iu);
        const m3 = text.match(/^(?:cho\s+(?:mình|minh|tôi|toi)\s+(?:hỏi|hoi)\s+)?(?:cuốn\s+sách|cuon\s+sach|quyển\s+sách|quyen\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)\s+(?:(?:hiện(?:\s+tại)?|hien(?:\s+tai)?)\s+)?(?:(?:có|co)\s+)?(?:(?:giá|gia)(?:\s+(?:bán|ban))?(?:\s+(?:là|la))?\s+bao\s+(?:nhiêu|nhieu)|bao\s+(?:nhiêu|nhieu)\s+(?:tiền|tien))/iu);
        const titleBeforePrice = m3?.[1].replace(/^\[(?:tê|te|tên|ten)\s*(?:sách|sach)\s+/iu, '');
        const title = cleanExtractedTitle(quoted?.[1] || titleBeforePrice || m1?.[1] || m2?.[1]);
        return { intent: 'book_price', title };
    }

    // 4. Author inquiry
    const authorAsk1 = text.match(/^(?:cho\s+(?:mình|minh|tôi|toi)\s+(?:hỏi|hoi)\s+)?(?:tác\s+giả|tac\s+gia)\s+(?:(?:của|cua)\s+)?(?:cuốn\s+sách|cuon\s+sach|quyển\s+sách|quyen\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen|tác\s+phẩm|tac\s+pham)?\s*(.+?)(?:\s+(?:là|la)\s+ai|\s+(?:tên|ten)\s+(?:(?:là|la)\s+)?(?:gì|gi)|\s+(?:vậy|vay|nhỉ|nhi|ạ|a))?$/iu);
    const authorAsk2 = text.match(/^(?:ai\s+(?:(?:là|la)\s+(?:tác\s+giả|tac\s+gia)|viết|viet|sáng\s+tác|sang\s+tac)\s+(?:(?:của|cua)\s+)?(?:(?:cuốn|cuon|quyển|quyen|sách|sach)\s+)?)(.+?)$/iu);
    const authorAsk3 = text.match(/^(?:cuốn\s+sách|cuon\s+sach|quyển\s+sách|quyen\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)\s+(?:(?:là|la)\s+(?:của|cua)\s+(?:tác\s+giả|tac\s+gia)\s+(?:nào|nao)|(?:của|cua)\s+(?:tác\s+giả|tac\s+gia)\s+(?:nào|nao)|do\s+ai\s+(?:viết|viet)|ai\s+(?:viết|viet))$/iu);
    if (authorAsk1 || authorAsk2 || authorAsk3) {
        const title = cleanExtractedTitle(quoted?.[1] || authorAsk1?.[1] || authorAsk2?.[1] || authorAsk3?.[1]);
        return { intent: 'book_detail', detailAspect: 'author', title };
    }

    // 5. Category inquiry for a specific book: "Rừng Xanh Nước Bạc thuộc thể loại gì?"
    const categoryAsk1 = text.match(/^(?:cho\s+(?:mình|minh)\s+(?:hỏi|hoi)\s+)?(?:thể\s+loại|the\s+loai)\s+(?:(?:của|cua)\s+)?(?:cuốn\s+sách|cuon\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)(?:\s+(?:là|la)\s+(?:gì|gi|nào|nao))?$/iu);
    const categoryAsk2 = text.match(/^(?:cuốn\s+sách|cuon\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)\s+(?:thuộc|thuoc)\s+(?:thể\s+loại|the\s+loai)\s+(?:gì|gi|nào|nao)(?:\s+(?:vậy|vay|nhỉ|nhi|ạ|a))?$/iu);
    if (categoryAsk1 || categoryAsk2) {
        const title = cleanExtractedTitle(quoted?.[1] || categoryAsk1?.[1] || categoryAsk2?.[1]);
        if (title) return { intent: 'book_detail', detailAspect: 'category', title };
    }

    // 6. Rating inquiry for a specific book: "Án mạng đỏ được đánh giá mấy sao?", "Nhà Giả Kim có được đánh giá cao không?"
    const ratingAsk1 = text.match(/^(?:đánh\s+giá|danh\s+gia|review)\s+(?:(?:về|ve|của|cua)\s+)?(?:cuốn\s+sách|cuon\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)$/iu);
    const ratingAsk2 = text.match(/^(?:cuốn\s+sách|cuon\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)\s+(?:(?:được|duoc)\s+(?:đánh\s+giá|danh\s+gia|chấm|cham)\s+(?:mấy|may|bao\s+nhiêu|bao\s+nhieu)\s+sao|(?:mấy|may)\s+sao|review\s+(?:thế\s+nào|the\s+nao|ra\s+sao))(?:\s+(?:vậy|vay|nhỉ|nhi|ạ|a))?$/iu);
    if (ratingAsk1 || ratingAsk2) {
        const title = cleanExtractedTitle(quoted?.[1] || ratingAsk1?.[1] || ratingAsk2?.[1]);
        if (title) return { intent: 'book_detail', detailAspect: 'rating', title };
    }

    // 7. Description / content inquiry: "Cuốn Nhà Giả Kim nói về gì vậy?", "Tóm tắt sách Nhà Giả Kim"
    const descAsk1 = text.match(/^(?:nội\s+dung|noi\s+dung|tóm\s+tắt|tom\s+tat|cốt\s+truyện|cot\s+truyen|giới\s+thiệu|gioi\s+thieu|thông\s+tin|thong\s+tin|chi\s+tiết|chi\s+tiet)\s+(?:(?:về|ve|của|cua)\s+)?(?:cuốn\s+sách|cuon\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)$/iu);
    const descAsk2 = text.match(/^(?:cuốn\s+sách|cuon\s+sach|cuốn|cuon|quyển|quyen|sách|sach|truyện|truyen)?\s*(.+?)\s+(?:nói|noi|viết|viet|kể|ke)\s+(?:về|ve)\s+(?:cái\s+|chủ\s+đề\s+|chu\s+de\s+|nội\s+dung\s+|noi\s+dung\s+)?(?:gì|gi)(?:\s+(?:vậy|vay|nhỉ|nhi|thế|the|ạ|a))?$/iu);
    if (descAsk1 || descAsk2) {
        const title = cleanExtractedTitle(quoted?.[1] || descAsk1?.[1] || descAsk2?.[1]);
        const detailAspect = descAsk1 && /thông\s+tin|thong\s+tin|chi\s+tiết|chi\s+tiet|giới\s+thiệu|gioi\s+thieu/iu.test(descAsk1[0]) ? 'general' : 'description';
        if (title) return { intent: 'book_detail', detailAspect, title };
    }

    const availability = text.match(/^(?:(?:shop|cửa\s+hàng|cua\s+hang)\s+)?(?:có|co)\s+(?:cuốn\s+sách|cuon\s+sach|cuốn|cuon|quyển|quyen)\s+(.+?)\s+(?:không|khong)$/iu);
    if (availability && !hasBudgetFilter && !/\b(nao|the loai)\b/.test(normalize(availability[1]))) {
        const title = cleanExtractedTitle(quoted?.[1] || availability[1]);
        if (title) return { intent: 'book_stock', title };
    }
    return null;
}

function localSmallTalk(question) {
    if (greetingPattern.test(question)) return 'greeting';
    if (thanksPattern.test(question)) return 'thanks';
    if (goodbyePattern.test(question)) return 'goodbye';
    return null;
}

function localIntent(question, previous, parsed) {
    if (localSmallTalk(question)) return 'greeting';
    if (parsed?.intent) return parsed.intent;
    if (ordinalPattern.test(question) && bookIds(previous.lastBookIds).length) return 'book_detail';
    if (policyPattern.test(question)) return 'policy_question';
    if (!/\b(sach|truyen|cuon|nha sach)\b/.test(question)
        && /\b(thoi tiet|gia vang|ty gia|du bao|viet code|giai bai tap)\b/.test(question)) return 'out_of_scope';
    if (discountPattern.test(question)) {
        discountPattern.lastIndex = 0;
        return 'discount_search';
    }
    return 'book_search';
}

function ordinalIndex(question, lastIds) {
    const match = question.match(ordinalPattern)?.[1];
    if (!match) return undefined;
    return match.startsWith('cuoi') ? lastIds.length : ordinalWords[match];
}

module.exports = {
    MAX_BOOKS,
    MAX_CATALOG_PAGES,
    normalize,
    normalizeTone,
    baseTitle,
    findMention,
    extractKeywords,
    isBudgetBrowse,
    validPrice,
    shortText,
    shortList,
    bookIds,
    cleanExtractedTitle,
    parseSpecificQuery,
    localSmallTalk,
    localIntent,
    ordinalIndex,
    ordinalPattern,
    contextRefPattern,
    clearPricePattern,
    discountPattern,
    regularPricePattern,
    anyDiscountPattern,
    preferencePattern,
    readBudget,
};
