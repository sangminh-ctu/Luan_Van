const catalog = require('../catalog.service');
const {
    MAX_BOOKS,
    MAX_CATALOG_PAGES,
    normalize,
    normalizeTone,
    baseTitle,
    shortText,
    shortList,
    findMention,
    validPrice,
    extractKeywords,
    cleanExtractedTitle,
    clearPricePattern,
    discountPattern,
    preferencePattern,
    ordinalIndex,
    bookIds,
    contextRefPattern,
    readBudget,
} = require('./fallback-parser');
const { carriedContext, respond } = require('./context');
const {
    formatPrice,
    formatPriceReply,
    formatStockReply,
    formatDetailReply,
    fallbackReason,
    fallbackListReply,
    describeFilters,
    templates,
    safeText,
    numbersOf,
    composeAnswer,
    composeListAnswer,
} = require('./answer');

function toCard(book) {
    const images = Array.isArray(book.images) ? book.images : [];
    const cover = images.find(image => image.is_primary) || images[0];
    const price = Number(book.final_price);
    const base = Number(book.base_price ?? book.price);
    const discounted = Number.isFinite(base) && base > price;
    const rawStock = book.inventory?.stock_quantity ?? book.stock_quantity;
    const hasExactStock = rawStock !== undefined && rawStock !== null && Number.isFinite(Number(rawStock));
    const stock = hasExactStock ? Math.max(0, Number(rawStock))
        : book.inStock === true ? 1 : book.inStock === false ? 0 : null;
    return {
        id: book.book_id,
        title: book.title,
        image: cover?.image_url || null,
        price,
        originalPrice: discounted ? base : null,
        discountPercent: discounted ? Number(book.effective_discount_percent) || Math.round((1 - price / base) * 100) : 0,
        stock,
        hasExactStock,
        description: shortText(book.description, 2000),
        authors: (book.authors || []).map(author => author.author_name).filter(Boolean).join(', '),
        category: book.category?.category_name || '',
    };
}

async function attachRatings(books) {
    if (typeof catalog.getRatingSummaries !== 'function' || !books.length) return;
    try {
        const ratings = await catalog.getRatingSummaries(books.map(book => book.id));
        for (const book of books) {
            const rating = ratings.get(book.id);
            book.rating = rating?.total ? rating : null;
        }
    } catch (error) {
        console.warn(`[chat] rating lookup failed: ${error.message}`);
    }
}

async function findBooksByTitle(targetTitle, { inStockOnly = false, allEditions = false } = {}) {
    const cleanTarget = cleanExtractedTitle(targetTitle) || shortText(targetTitle, 150);
    const targetNorm = normalize(cleanTarget);
    const targetTone = normalizeTone(cleanTarget);
    const targetBaseNorm = normalize(baseTitle(cleanTarget));
    const targetBaseTone = normalizeTone(baseTitle(cleanTarget));
    if (!targetNorm) return [];

    const pool = new Map();
    const addRows = rows => {
        for (const row of rows || []) {
            if (!pool.has(row.book_id)) pool.set(row.book_id, row);
        }
    };

    const queryBase = inStockOnly ? { in_stock: true, limit: 48 } : { limit: 48 };
    if (!/[%_\\]/.test(cleanTarget)) {
        const { books } = await catalog.getBooks({ ...queryBase, search: cleanTarget }, { chatTitle: targetNorm });
        addRows(books);
        const baseClean = baseTitle(cleanTarget);
        if ((!pool.size || allEditions) && baseClean && baseClean !== cleanTarget) {
            const retry = await catalog.getBooks({ ...queryBase, search: baseClean }, { chatTitle: targetBaseNorm });
            addRows(retry.books);
        }
    }
    if (!pool.size) {
        for (let page = 1; page <= MAX_CATALOG_PAGES; page += 1) {
            const { books, pagination } = await catalog.getBooks({ ...queryBase, page });
            addRows(books);
            if (page >= pagination.totalPages) break;
        }
    }

    const tier1Tone = [];
    const tier1Norm = [];
    const tier2Tone = [];
    const tier2Norm = [];
    const tier3Phrase = [];
    const tier4Words = [];
    const targetWords = targetBaseNorm.split(' ').filter(Boolean);

    for (const raw of pool.values()) {
        const card = toCard(raw);
        const fullTone = normalizeTone(card.title);
        const fullNorm = normalize(card.title);
        const baseTone = normalizeTone(baseTitle(card.title));
        const baseNorm = normalize(baseTitle(card.title));

        if (fullTone === targetTone) tier1Tone.push(card);
        if (fullNorm === targetNorm) tier1Norm.push(card);
        if (baseTone && baseTone === targetBaseTone) tier2Tone.push(card);
        if (baseNorm && baseNorm === targetBaseNorm) tier2Norm.push(card);
        if (` ${fullNorm} `.includes(` ${targetNorm} `) || (targetBaseNorm && ` ${baseNorm} `.includes(` ${targetBaseNorm} `))) {
            tier3Phrase.push(card);
        } else if (targetWords.length >= 2) {
            const titleWordSet = new Set(fullNorm.split(' ').filter(Boolean));
            const baseWordCount = Math.max(1, baseNorm.split(' ').filter(Boolean).length);
            if (targetWords.every(w => titleWordSet.has(w)) && targetWords.length / baseWordCount >= 0.6) {
                tier4Words.push(card);
            }
        }
    }

    if (allEditions) return tier2Tone.length ? tier2Tone : tier2Norm;
    for (const tier of [tier1Tone, tier1Norm, tier2Tone, tier2Norm, tier3Phrase, tier4Words]) {
        if (tier.length) return tier;
    }
    return [];
}

async function loadBooksByIds(ids) {
    const results = [];
    for (const id of ids) {
        try {
            results.push(toCard(await catalog.getBookById(id)));
        } catch (error) {
            if (error.status !== 404) throw error;
        }
    }
    return results;
}

async function searchBooks({ context, keywords, broad, cheaper, deadline, requireTopic }) {
    const query = {
        category_id: context.categoryId, author_id: context.authorId,
        min_price: context.minPrice, max_price: context.maxPrice,
        in_stock: true, sort: cheaper ? 'price_asc' : context.onSale ? 'discount_desc' : 'featured', limit: 48,
    };
    const options = {
        discountedOnly: context.onSale === true,
        regularPriceOnly: context.regularPriceOnly === true,
        chatTerms: requireTopic ? keywords : undefined,
        chatTopic: normalize(context.topicLabel),
    };
    const candidates = new Map();
    const targetNorm = normalize(context.title);
    const rankWords = keywords.length ? keywords : extractKeywords(context.title);
    const topic = options.chatTopic ? ` ${options.chatTopic} ` : '';
    function scoreBooks(books) {
        for (const book of books) {
            if (candidates.has(book.book_id)) continue;
            const card = toCard(book);
            if (context.regularPriceOnly && card.originalPrice !== null) continue;
            if (context.minDiscount !== undefined && card.discountPercent < context.minDiscount) continue;
            const title = normalize(book.title);
            const baseNorm = normalize(baseTitle(book.title));
            const words = new Set(normalize(card.description).split(' '));
            const titleWords = new Set(title.split(' '));
            const metadataWords = new Set(normalize(`${card.authors} ${card.category}`).split(' '));
            const exactTitle = Boolean(targetNorm && (title === targetNorm || baseNorm === targetNorm || ` ${title} `.includes(` ${targetNorm} `)));
            const score = rankWords.reduce((sum, word) => sum + 4 * Number(titleWords.has(word))
                + 2 * Number(metadataWords.has(word)) + 2 * Number(words.has(word)), exactTitle ? 100 : 0);
            const matchesFilters = broad || context.onSale || context.regularPriceOnly
                || (!context.title && (context.categoryId || context.authorId || context.maxPrice !== undefined));
            const subjectIntro = topic ? normalize(card.description).match(/^(?:cuon sach|sach|giao trinh|tai lieu|tac pham)(?: nay)? (?:ve|gioi thieu|huong dan|trinh bay|phan tich) .{1,100}/)?.[0] : undefined;
            const matchesTopic = topic
                ? [title, normalize(card.category), subjectIntro].some(value => value && ` ${value} `.includes(topic))
                : requireTopic && rankWords.every(word => titleWords.has(word) || words.has(word));
            if (exactTitle || (!targetNorm && (requireTopic ? matchesTopic : score || matchesFilters))) {
                const beginnerMatch = context.audience === 'beginner'
                    && /\b(nguoi moi|moi bat dau|nhap mon|co ban)\b/.test(normalize(card.title + ' ' + card.description));
                candidates.set(book.book_id, { ...card, score: score + Number(beginnerMatch) * 4 });
            }
        }
    }
    if (context.title && !/[%_\\]/.test(context.title) && deadline > Date.now()) {
        const { books } = await catalog.getBooks({ ...query, search: context.title }, { ...options, chatTitle: targetNorm });
        scoreBooks(books);
    }
    for (let page = 1; page <= MAX_CATALOG_PAGES && Date.now() < deadline; page += 1) {
        const { books, pagination } = await catalog.getBooks({ ...query, page }, options);
        scoreBooks(books);
        if (page >= pagination.totalPages) break;
    }
    const sorted = Array.from(candidates.values()).sort((a, b) => b.score - a.score
        || (context.onSale ? b.discountPercent - a.discountPercent : 0)
        || (cheaper ? a.price - b.price : 0));
    return sorted.slice(0, MAX_BOOKS);
}

function matchCandidateEdition(candidates, message, question) {
    const idx = ordinalIndex(question, candidates.map(book => book.id));
    if (idx >= 1 && idx <= candidates.length) return [candidates[idx - 1]];

    const msgTone = normalizeTone(message);
    const msgNorm = normalize(message);
    const scored = candidates.map(book => {
        const fullTone = normalizeTone(book.title);
        const fullNorm = normalize(book.title);
        const baseNorm = normalize(baseTitle(book.title));
        const qualifierWords = fullNorm.split(' ').filter(w => w && !baseNorm.split(' ').includes(w));
        const matchedQualifiers = qualifierWords.filter(w => ` ${msgNorm} `.includes(` ${w} `)).length;
        const exact = fullTone === msgTone || fullNorm === msgNorm ? 100 : 0;
        return { book, score: exact + matchedQualifiers };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

    if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) {
        return [scored[0].book];
    }
    return [];
}

async function answerCheaperEdition(book, context) {
    const matches = await findBooksByTitle(book.title, { inStockOnly: true, allEditions: true });
    const editions = matches.filter(other => other.id !== book.id && other.price < book.price)
        .sort((a, b) => a.price - b.price).slice(0, MAX_BOOKS);
    const reference = `“${book.title}” (${formatPrice(book.price)})`;
    if (!editions.length) {
        return respond(`Mình chưa tìm thấy phiên bản còn hàng rẻ hơn ${reference}.`, 'template', 'book_search', [], context);
    }
    return respond(`Mình tìm được ${editions.length} phiên bản còn hàng rẻ hơn ${reference}.`, 'template', 'book_search',
        editions.map(edition => ({ ...edition, reason: fallbackReason(edition, {}) })), {
            ...context, lastBookIds: editions.map(edition => edition.id),
            selectedBookId: editions.length === 1 ? editions[0].id : undefined, referencePrice: editions[0].price,
            candidateBookIds: undefined, pendingIntent: undefined, pendingAspect: undefined, pendingAspects: undefined,
        });
}

async function finalizeSingleBook(book, { intent, detailAspect, aspects, message, aiAvailable, remaining, context }) {
    await attachRatings([book]);
    const nextContext = {
        ...context,
        title: book.title,
        selectedBookId: book.id,
        lastBookIds: [book.id],
        referencePrice: book.price,
        candidateBookIds: undefined, pendingIntent: undefined, pendingAspect: undefined, pendingAspects: undefined,
    };
    const card = { ...book, reason: fallbackReason(book, {}) };

    if (aspects?.length) {
        const stock = book.stock === null ? 'Chưa có thông tin tồn kho.'
            : book.stock === 0 ? 'Hiện đã hết hàng.'
                : book.hasExactStock ? `Còn ${book.stock} cuốn trong kho.` : 'Hiện còn hàng.';
        const facts = {
            stock,
            price: `Giá bán hiện tại là ${formatPrice(book.price)}.`,
            discount: book.originalPrice !== null
                ? `Giá gốc ${formatPrice(book.originalPrice)}, giảm ${book.discountPercent}%.`
                : 'Hiện không giảm giá.',
        };
        const reply = intent === 'book_price' && aspects.length === 2 && aspects.includes('discount') && book.originalPrice !== null
            ? formatPriceReply(book)
            : [`“${book.title}”`, ...aspects.map(aspect => facts[aspect] ?? formatDetailReply(book, aspect))].join(' ');
        return { ...respond(reply, 'template', intent, [card], nextContext), aspect: aspects[0], aspects };
    }

    if (intent === 'book_price') {
        return respond(formatPriceReply(book), 'template', 'book_price', [card], nextContext);
    }
    if (intent === 'book_stock') {
        return respond(formatStockReply(book), 'template', 'book_stock', [card], nextContext);
    }
    if (detailAspect === 'author' || detailAspect === 'category' || detailAspect === 'rating' || detailAspect === 'description') {
        return { ...respond(formatDetailReply(book, detailAspect), 'template', 'book_detail', [card], nextContext), aspect: detailAspect };
    }

    const composed = aiAvailable && await composeAnswer({
        mode: 'detail',
        message,
        intent: 'book_detail',
        books: [{
            id: book.id, title: book.title, authors: book.authors, category: book.category,
            description: shortText(book.description, 1500), discountPercent: book.discountPercent, rating: book.rating ?? null,
        }],
    }, remaining());
    const advice = composed?.ok ? composed.data : null;
    const allowed = numbersOf(book);
    const aiReply = safeText(advice?.reply, 700, allowed);
    const aiReason = Array.isArray(advice?.items)
        ? safeText(advice.items.find(item => item?.id === book.id)?.reason, 300, allowed) : '';

    return { ...respond(
        aiReply || formatDetailReply(book, 'general'),
        aiReply ? composed.provider : 'template',
        'book_detail',
        [{ ...card, reason: aiReason || card.reason }],
        nextContext,
    ), aspect: detailAspect };
}

async function answerSingleBookIntent({
    intent, detailAspect, aspects, message, question, targetTitle, ai, aiAvailable, previous, lastIds, remaining, preloadedMatches, cheaperEdition,
}) {
    const context = { ...carriedContext(previous) };
    const candidateIds = bookIds(previous.candidateBookIds);
    const finish = (book, nextContext) => cheaperEdition
        ? answerCheaperEdition(book, nextContext)
        : finalizeSingleBook(book, { intent, detailAspect, aspects, message, aiAvailable, remaining, context: nextContext });

    // 1. Disambiguating among multiple editions from previous turn
    if (candidateIds.length > 1 && !targetTitle) {
        const candidates = await loadBooksByIds(candidateIds);
        const chosen = matchCandidateEdition(candidates, message, question);
        if (chosen.length === 1) {
            return finish(chosen[0], context);
        }
    }

    // 2. Ordinal or context pronoun reference
    const index = ordinalIndex(question, lastIds) ?? (!targetTitle ? ai?.bookIndex : undefined);
    const refersToContext = !targetTitle || contextRefPattern.test(question);
    if (index >= 1 && index <= lastIds.length) {
        const [book] = await loadBooksByIds([lastIds[index - 1]]);
        if (book) return finish(book, context);
    }
    if (!targetTitle && index !== undefined) {
        const reply = lastIds.length ? `Danh sách vừa gửi có ${lastIds.length} cuốn. Bạn muốn hỏi cuốn thứ mấy?` : templates.askBook;
        return respond(reply, 'template', intent, [], context);
    }
    if (refersToContext && !targetTitle) {
        const contextBookId = Number.isSafeInteger(previous.selectedBookId) && previous.selectedBookId > 0
            ? previous.selectedBookId
            : (lastIds.length === 1 ? lastIds[0] : undefined);
        if (contextBookId) {
            const [book] = await loadBooksByIds([contextBookId]);
            if (book) return finish(book, context);
        }
        if (lastIds.length > 1) {
            return respond(
                'Ở lượt trước có nhiều hơn một cuốn sách. Bạn muốn hỏi cuốn thứ mấy (ví dụ: cuốn thứ nhất, cuốn thứ hai) hay nêu tên cuốn sách giúp mình nhé?',
                'template',
                intent,
                [],
                context,
            );
        }
        return respond(templates.askBook, 'template', intent, [], context);
    }

    // 3. Look up by title across catalog
    const matches = preloadedMatches ?? await findBooksByTitle(targetTitle, { inStockOnly: false });
    if (!matches.length) {
        return respond(
            `Hiện cửa hàng chưa có cuốn sách “${targetTitle}”.`,
            'template',
            intent,
            [],
            context,
        );
    }

    // 4. Multiple valid editions found
    if (matches.length > 1) {
        const editions = matches.slice(0, MAX_BOOKS);
        await attachRatings(editions);
        const cards = editions.map(book => ({ ...book, reason: fallbackReason(book, {}) }));
        const names = editions.map(book => `“${book.title}” (${formatPrice(book.price)})`).join(', ');
        return respond(
            `Hiện cửa hàng có ${editions.length} phiên bản cho “${targetTitle}”: ${names}. Bạn muốn xem phiên bản nào?`,
            'template',
            intent,
            cards,
            {
                ...context,
                title: targetTitle,
                candidateBookIds: editions.map(book => book.id),
                lastBookIds: editions.map(book => book.id),
                selectedBookId: undefined,
                pendingIntent: intent,
                pendingAspect: detailAspect,
                pendingAspects: aspects,
            },
        );
    }

    return finish(matches[0], context);
}

async function recommendSimilarBooks({ similarToTitle, message, aiAvailable, previous, categories, remaining, plainSource }) {
    const context = { ...carriedContext(previous) };
    const matches = await findBooksByTitle(similarToTitle, { inStockOnly: false });
    const refBook = matches[0];
    if (!refBook) {
        return respond(
            `Mình chưa tìm thấy cuốn “${similarToTitle}”.`,
            'template',
            'book_recommendation',
            [],
            context,
        );
    }

    const refCategory = categories.find(item => normalize(item.category_name) === normalize(refBook.category));
    const query = {
        category_id: refCategory?.category_id,
        in_stock: true,
        sort: 'featured',
        limit: 48,
    };
    const { books } = await catalog.getBooks(query);
    const referenceWords = new Set(extractKeywords(refBook.description));
    const related = books
        .filter(item => item.book_id !== refBook.id)
        .map(toCard)
        .map(book => ({
            ...book,
            relevance: extractKeywords(book.description).filter(word => referenceWords.has(word)).length
                + 2 * Number(Boolean(refBook.authors && refBook.authors === book.authors)),
        }))
        .filter(book => book.relevance >= 2)
        .sort((a, b) => b.relevance - a.relevance);

    const ranked = related.slice(0, MAX_BOOKS);
    if (!ranked.length) {
        return respond(
            `Mình chưa tìm được cuốn còn hàng có đủ thông tin để gợi ý tương tự “${refBook.title}”.`,
            'template',
            'book_recommendation',
            [],
            { ...context, categoryId: refCategory?.category_id },
        );
    }

    await attachRatings(ranked);
    const nextContext = {
        ...context,
        categoryId: refCategory?.category_id,
        title: '',
        selectedBookId: ranked.length === 1 ? ranked[0].id : undefined,
        lastBookIds: ranked.map(book => book.id),
        referencePrice: Math.min(...ranked.map(book => book.price)),
    };

    const filters = {
        onSale: false,
        category: refBook.category || null,
        author: null,
        title: null,
        maxPrice: null,
        keywords: [],
        preferences: [`tương tự ${refBook.title}`],
    };
    const { reasons, aiReply, replySource } = await composeListAnswer({
        aiAvailable, remaining, message, intent: 'book_recommendation', filters, ranked, plainSource,
    });
    const cards = ranked.map(book => ({
        ...book,
        reason: reasons.get(book.id)
            || `Cùng thể loại ${book.category || 'sách'} với “${refBook.title}”. ${fallbackReason(book, { categoryId: refCategory?.category_id })}`,
    }));
    const defaultReply = `Mình tìm được ${cards.length} cuốn có điểm chung với “${refBook.title}”, dựa trên tác giả hoặc mô tả sách.`;

    return respond(
        aiReply || defaultReply,
        replySource,
        'book_recommendation',
        cards,
        nextContext,
    );
}

async function recommendFromCatalog({
    message, question, intent, ai, aiAvailable, aiSource, previous, categories, authors,
    previousCategory, previousAuthor, previousTitle, previousKeywords, previousPreferences,
    quotedTitle, plainSource, deadline, remaining, budgetBrowse, plan, broadTopic,
}) {
    const cheaper = /\bre hon\b/.test(question) || ai?.cheaper === true;
    const budget = plan.localBudget;
    const wantsRegularPrice = plan.discountStatus === 'regular';
    const clearPrice = clearPricePattern.test(question) || ai?.clearPrice === true;
    const switching = /\b(doi sang|chuyen sang|thay bang)\b/.test(question);
    const statedCategory = plan.genreCategoryId ?? findMention(categories, 'category_id', 'category_name', question);
    const categoryId = statedCategory
        ?? categories.find(item => normalize(item.category_name) === normalize(plan.category))?.category_id;
    const authorId = findMention(authors, 'author_id', 'author_name', question)
        ?? authors.find(item => normalize(item.author_name) === normalize(plan.author))?.author_id;
    const discount = question.match(/\bgiam(?: gia)?(?: tu| it nhat| toi thieu)? (\d{1,3})\b/);
    const minDiscount = discount && /%|phần\s+trăm/iu.test(message) ? Number(discount[1]) : undefined;
    const searchText = minDiscount === undefined ? message : message.replace(/(?:giảm|giam)(?:\s+(?:giá|gia))?(?:\s+(?:từ|tu|ít\s+nhất|it\s+nhat|tối\s+thiểu|toi\s+thieu))?\s+\d{1,3}\s*(?:%|phần\s+trăm|phan\s+tram)/iu, ' ');
    const genericReply = /^(gi cung duoc|bat ky|cuon nao cung duoc|tuy ban|khong biet)$/.test(question);
    const beginner = /\b(nguoi moi|moi bat dau|nhap mon|co ban)\b/.test(question) || plan.audience === 'beginner';
    const statedCategoryName = categories.find(item => item.category_id === categoryId)?.category_name || '';
    const statedAuthorName = authors.find(item => item.author_id === authorId)?.author_name || '';
    const entityWords = new Set(normalize(`${statedCategoryName} ${statedAuthorName}`).split(' ').filter(Boolean));
    const searchTerms = wantsRegularPrice ? searchText.replace(/(?:không|khong)\s+(?:(?:đang|dang)\s+)?(?:giảm\s+giá|giam\s+gia|(?:(?:có|co)\s+)?(?:khuyến\s+mãi|khuyen\s+mai))/iu, ' ') : searchText;
    const localKeywords = genericReply || budgetBrowse || plan.keepSubject || plan.priceUpdate ? [] : extractKeywords(plan.withoutDiscountChoice ?? searchTerms)
        .filter(word => !entityWords.has(word) && !(beginner && ['hoc', 'nguoi', 'moi', 'bat', 'dau', 'nhap', 'mon', 'co', 'ban'].includes(word)));
    const budgetOnly = budget.maxPrice !== undefined && !localKeywords.length;
    const followUp = plan.keepSubject || (!budgetBrowse && !broadTopic && (intent === 'follow_up' || cheaper || switching || clearPrice || ai?.followUp === true
        || (budgetOnly && !wantsRegularPrice)
        || (plan.discountStatus === 'any' && !localKeywords.length)
        || previous.askedClarification === true));
    const explicitDiscount = !plan.discountStatus && (minDiscount !== undefined || discountPattern.test(question));
    discountPattern.lastIndex = 0;
    const discountStatus = plan.discountStatus ?? (explicitDiscount || intent === 'discount_search' ? 'sale' : undefined)
        ?? (followUp ? previous.discountStatus : undefined);
    const regularPriceOnly = discountStatus === 'regular';
    const preferences = shortList(ai?.preferences, 80, 5);
    if (!preferences.length) preferences.push(...(question.match(preferencePattern) || []).slice(0, 5));

    const explicitTitle = cleanExtractedTitle(quotedTitle || shortText(plan.title, 150));
    const context = {
        categoryId: categoryId ?? (followUp ? previousCategory?.category_id : undefined),
        authorId: authorId ?? (followUp ? previousAuthor?.author_id : undefined),
        maxPrice: followUp && validPrice(previous.maxPrice) ? previous.maxPrice : undefined,
        minPrice: clearPrice ? undefined : plan.budget.maxPrice !== undefined ? plan.budget.minPrice
            : followUp ? previous.minPrice : undefined,
        minDiscount: discountStatus === 'sale' ? minDiscount ?? (followUp ? previous.minDiscount : undefined) : undefined,
        audience: beginner ? 'beginner' : followUp ? previous.audience : undefined,
        topicLabel: broadTopic || (followUp && !switching && !localKeywords.length ? previous.topicLabel : undefined),
        // Only carry previousTitle if we didn't just inspect a single book (selectedBookId) unless explicitly following up on title
        title: explicitTitle || (followUp && !previous.selectedBookId && !switching && !cheaper && !categoryId && !authorId ? previousTitle : ''),
        preferences: preferences.length ? preferences : followUp ? previousPreferences : [],
        discountStatus,
        onSale: discountStatus === 'sale' || undefined,
        regularPriceOnly: regularPriceOnly || undefined,
    };
    if (clearPrice) context.maxPrice = undefined;
    else if (validPrice(budget.maxPrice) || budget.maxPrice === -1) context.maxPrice = budget.maxPrice;
    else if (budget.unclear || budget.maxPrice !== undefined) context.pendingPrice = true;
    else if (validPrice(plan.budget.maxPrice) || plan.budget.maxPrice === -1) context.maxPrice = plan.budget.maxPrice;
    const strictLimit = plan.budget.strict ? plan.budget.maxPrice
        : followUp && budget.maxPrice === undefined && !validPrice(ai?.maxPrice) && previous.strictBudget === true
            ? previous.maxPrice : undefined;
    if (cheaper) {
        if (!validPrice(previous.referencePrice) && context.maxPrice === undefined) {
            context.pendingPrice = true;
        } else if (validPrice(previous.referencePrice)) {
            context.maxPrice = Math.min(context.maxPrice ?? Infinity, previous.referencePrice - 1);
        }
    }
    if (previous.pendingPrice === true && !clearPrice && budget.maxPrice === undefined && !validPrice(ai?.maxPrice)) {
        const statedPrice = readBudget(`tối đa ${message}`).maxPrice;
        if (validPrice(statedPrice)) {
            context.maxPrice = statedPrice;
            context.pendingPrice = undefined;
        } else context.pendingPrice = true;
    }

    if ((strictLimit !== undefined && context.maxPrice === strictLimit)
        || (cheaper && validPrice(previous.referencePrice) && context.maxPrice === previous.referencePrice - 1)) context.strictBudget = true;

    if (context.title && !context.categoryId && !context.authorId && !context.onSale && !regularPriceOnly && context.maxPrice === undefined) {
        const titleMatches = await findBooksByTitle(context.title, { inStockOnly: true });
        if (titleMatches.length === 1) {
            const [book] = titleMatches;
            await attachRatings([book]);
            context.selectedBookId = book.id;
            context.lastBookIds = [book.id];
            context.referencePrice = book.price;
            context.keywords = [];
            return respond(
                `Mình tìm thấy cuốn “${book.title}” đang còn hàng tại cửa hàng với giá ${formatPrice(book.price)}:`,
                'template',
                intent,
                [{ ...book, reason: fallbackReason(book, context) }],
                context,
            );
        }
        if (titleMatches.length > 1) {
            const editions = titleMatches.slice(0, MAX_BOOKS);
            await attachRatings(editions);
            context.candidateBookIds = editions.map(book => book.id);
            context.lastBookIds = editions.map(book => book.id);
            context.referencePrice = Math.min(...editions.map(book => book.price));
            context.keywords = [];
            const names = editions.map(book => `“${book.title}” (${formatPrice(book.price)})`).join(', ');
            return respond(
                `Hiện cửa hàng có ${editions.length} phiên bản cho “${context.title}”: ${names}. Bạn muốn chọn phiên bản nào?`,
                'template',
                intent,
                editions.map(book => ({ ...book, reason: fallbackReason(book, context) })),
                context,
            );
        }
    }

    const inferredKeywords = extractKeywords(shortList(ai?.keywords, 80, 8).join(' '))
        .filter(word => !entityWords.has(word));
    const keywords = inferredKeywords.length ? inferredKeywords
        : followUp && !switching && (cheaper || clearPrice || !localKeywords.length)
            ? previousKeywords : localKeywords;
    context.keywords = keywords;
    if (context.pendingPrice) {
        return respond(templates.askPrice, 'template', intent, [], { ...context, askedClarification: true });
    }
    const broad = !keywords.length && !context.title && !context.categoryId && !context.authorId
        && context.maxPrice === undefined && !context.onSale && !regularPriceOnly;
    if ((!regularPriceOnly && ai?.needsClarification === true || broad) && previous.askedClarification !== true) {
        const reply = safeText(ai?.reply, 400);
        return respond(reply || templates.clarify, reply ? aiSource : plainSource, intent, [], { ...context, askedClarification: true });
    }

    const filters = describeFilters(context, categories, authors);
    if (context.maxPrice !== undefined && context.maxPrice < (context.minPrice ?? 0)) {
        return respond(templates.noBooks, plainSource, intent, [], context);
    }
    const topic = shortText(plan.topic, 100);
    const explicitTopic = topic && (` ${question} `.includes(` ${normalize(topic)} `)) ? topic : '';
    const budgetTopic = budget.maxPrice !== undefined && !statedCategory && !authorId && localKeywords.length;
    const requiredKeywords = explicitTopic ? extractKeywords(explicitTopic)
        : budgetTopic ? localKeywords
            : followUp && !switching && !localKeywords.length && previous.requiredKeywords?.length ? previous.requiredKeywords
                : !context.categoryId && !context.authorId ? keywords : [];
    if (requiredKeywords.length) context.requiredKeywords = requiredKeywords;
    const search = {
        context,
        keywords: requiredKeywords.length ? requiredKeywords : keywords,
        broad,
        cheaper,
        deadline,
        requireTopic: requiredKeywords.length > 0,
    };
    const ranked = await searchBooks(search);

    if (!ranked.length) {
        if (followUp && validPrice(previous.referencePrice)) context.referencePrice = previous.referencePrice;
        return respond(templates.noBooks, plainSource, intent, [], context);
    }
    await attachRatings(ranked);
    context.referencePrice = Math.min(...ranked.map(book => book.price));
    context.lastBookIds = ranked.map(book => book.id);
    context.selectedBookId = ranked.length === 1 ? ranked[0].id : undefined;

    const { reasons, aiReply, replySource } = await composeListAnswer({
        aiAvailable: aiAvailable && !discountStatus, remaining, message, intent, filters, ranked, plainSource,
    });
    const books = ranked.map(book => ({ ...book, reason: reasons.get(book.id) || fallbackReason(book, context) }));
    return respond(
        aiReply || fallbackListReply(filters, books.length),
        replySource,
        intent,
        books,
        context,
    );
}

module.exports = {
    toCard,
    attachRatings,
    findBooksByTitle,
    loadBooksByIds,
    searchBooks,
    matchCandidateEdition,
    answerSingleBookIntent,
    finalizeSingleBook,
    recommendSimilarBooks,
    recommendFromCatalog,
};
