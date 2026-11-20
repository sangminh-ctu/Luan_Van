const { bookIds, validPrice, shortText, shortList } = require('./fallback-parser');
const { INTENTS, DETAIL_ASPECTS, DISCOUNT_STATUSES, LOOKUP_ASPECTS } = require('./understand');

function sanitizePrevious(previous) {
    if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return {};
    const context = {};
    for (const key of ['categoryId', 'authorId', 'selectedBookId']) {
        if (Number.isSafeInteger(previous[key]) && previous[key] > 0) context[key] = previous[key];
    }
    for (const key of ['minPrice', 'maxPrice', 'referencePrice', 'minDiscount']) {
        if (validPrice(previous[key])) context[key] = previous[key];
    }
    for (const key of ['onSale', 'regularPriceOnly', 'strictBudget', 'askedClarification', 'pendingPrice']) {
        if (previous[key] === true) context[key] = true;
    }
    for (const key of ['lastBookIds', 'candidateBookIds']) {
        const ids = bookIds(previous[key]);
        if (ids.length) context[key] = ids;
    }
    if (typeof previous.title === 'string') context.title = shortText(previous.title, 150);
    if (typeof previous.topicLabel === 'string') context.topicLabel = shortText(previous.topicLabel, 80);
    if (previous.audience === 'beginner') context.audience = 'beginner';
    if (previous.genre === 'comics') context.genre = 'comics';
    if (Array.isArray(previous.keywords)) context.keywords = shortList(previous.keywords, 30, 20);
    if (Array.isArray(previous.requiredKeywords)) context.requiredKeywords = shortList(previous.requiredKeywords, 30, 20)
        .filter(word => /^[a-z]{2,30}$/.test(word));
    if (Array.isArray(previous.preferences)) context.preferences = shortList(previous.preferences, 80, 5);
    if (DISCOUNT_STATUSES.includes(previous.discountStatus)) context.discountStatus = previous.discountStatus;
    else if (context.regularPriceOnly) context.discountStatus = 'regular';
    else if (context.onSale) context.discountStatus = 'sale';
    if (Array.isArray(previous.pendingAspects)) context.pendingAspects = LOOKUP_ASPECTS.filter(aspect => previous.pendingAspects.includes(aspect));
    if (INTENTS.includes(previous.pendingIntent)) context.pendingIntent = previous.pendingIntent;
    if (DETAIL_ASPECTS.includes(previous.pendingAspect)) context.pendingAspect = previous.pendingAspect;
    return context;
}

function stockStatusOf(book) {
    if (book.stock === null || book.stock === undefined) return 'unknown';
    if (book.stock <= 0) return 'out';
    if (book.hasExactStock && book.stock <= 5) return 'low';
    return 'in_stock';
}

function buildSuggestions(intent, books, context) {
    if (Array.isArray(context?.candidateBookIds) && context.candidateBookIds.length > 1 && books.length > 1) {
        return books.slice(0, 3).map(book => ({
            label: shortText(book.title, 40),
            message: book.title,
        }));
    }
    if (['book_price', 'book_stock', 'book_detail'].includes(intent) && books.length === 1) {
        const title = books[0].title;
        return [
            { label: 'Tóm tắt nội dung', message: `Cuốn ${title} nói về gì?` },
            { label: 'Sách tương tự', message: `Có sách nào giống ${title} không?` },
            { label: 'Có bản rẻ hơn không?', message: 'Cuốn này có bản rẻ hơn không?' },
        ];
    }
    if (['book_search', 'book_recommendation', 'discount_search', 'follow_up'].includes(intent) && books.length > 0) {
        const list = [{ label: 'Rẻ hơn', message: 'Có cuốn nào rẻ hơn không?' }];
        if (!context?.onSale) list.push({ label: 'Đang giảm giá', message: 'Có cuốn nào đang giảm giá không?' });
        if (context?.maxPrice !== undefined) list.push({ label: 'Bỏ giới hạn giá', message: 'Bỏ giới hạn giá' });
        return list.slice(0, 3);
    }
    return [];
}

function respond(reply, replySource, intent, books, context) {
    const cards = books.map(book => {
        const card = {
            id: book.id,
            title: book.title,
            image: book.image,
            price: book.price,
            originalPrice: book.originalPrice,
            discountPercent: book.discountPercent,
            reason: book.reason,
        };
        if (book.authors) card.authors = book.authors;
        if (book.category) card.category = book.category;
        if (book.rating) card.rating = book.rating;
        if (book.stock !== undefined) card.stockStatus = stockStatusOf(book);
        return card;
    });
    return {
        reply,
        replySource,
        intent,
        books: cards,
        suggestions: buildSuggestions(intent, books, context),
        context,
    };
}

function carriedContext(previous) {
    const keep = [
        'categoryId', 'authorId', 'minPrice', 'maxPrice', 'minDiscount', 'audience', 'genre', 'title', 'topicLabel', 'preferences', 'keywords', 'requiredKeywords',
        'referencePrice', 'strictBudget', 'askedClarification', 'pendingPrice', 'onSale', 'regularPriceOnly', 'lastBookIds', 'selectedBookId', 'candidateBookIds', 'pendingIntent', 'pendingAspect', 'pendingAspects', 'discountStatus',
    ];
    return Object.fromEntries(keep.filter(key => previous[key] !== undefined).map(key => [key, previous[key]]));
}

module.exports = { sanitizePrevious, carriedContext, respond, buildSuggestions, stockStatusOf };
