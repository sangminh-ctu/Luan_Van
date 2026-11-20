const catalog = require('../catalog.service');
const { interpretQuestion, localRequest, resolveRequest, settings } = require('./understand');
const {
    normalize,
    extractKeywords,
    bookIds,
    shortText,
    shortList,
    validPrice,
    localSmallTalk,
    contextRefPattern,
    ordinalIndex,
    ordinalPattern,
    localIntent,
    cleanExtractedTitle,
    isBudgetBrowse,
} = require('./fallback-parser');
const { sanitizePrevious, respond, carriedContext } = require('./context');
const { pick, templates, safeText } = require('./answer');
const {
    loadBooksByIds,
    findBooksByTitle,
    matchCandidateEdition,
    finalizeSingleBook,
    answerSingleBookIntent,
    recommendSimilarBooks,
    recommendFromCatalog,
} = require('./catalog');
const { answerPolicy, isPolicyQuestion } = require('./knowledge');

const TURN_TIMEOUT_MS = 28000;

async function recommend(message, rawPrevious = {}, { loadDocuments } = {}) {
    const deadline = Date.now() + TURN_TIMEOUT_MS;
    const perCall = settings().timeout;
    const remaining = () => Math.max(0, Math.min(deadline - Date.now(), perCall));
    const previous = sanitizePrevious(rawPrevious);
    const question = normalize(message);
    const lastIds = bookIds(previous.lastBookIds);
    const candidateIds = bookIds(previous.candidateBookIds);

    // 1. Pure small talk ("xin chào", "cảm ơn", "tạm biệt") answered immediately without calling AI
    const smallTalk = localSmallTalk(question);
    if (smallTalk) {
        return respond(pick(templates[smallTalk]), 'template', 'greeting', [], carriedContext(previous));
    }

    // 2. Local signals & edition disambiguation
    const local = localRequest(message, question);
    const { parsed } = local;
    if (local.cheaperEdition && (ordinalPattern.test(question) || contextRefPattern.test(question)
        || /^(?:co )?(?:phien ban|an ban|ban)\b/.test(question))) {
        return answerSingleBookIntent({
            intent: 'book_detail', detailAspect: 'general', message, question, targetTitle: '',
            previous, lastIds, remaining, cheaperEdition: true,
        });
    }
    if (loadDocuments && !parsed && isPolicyQuestion(question)) {
        const { reply, sources } = await answerPolicy(message, loadDocuments);
        return { ...respond(reply, 'template', 'policy_question', [], carriedContext(previous)), sources };
    }
    if (candidateIds.length > 1 && !parsed?.intent) {
        const candidates = await loadBooksByIds(candidateIds);
        const chosen = matchCandidateEdition(candidates, message, question);
        if (chosen.length === 1) {
            return finalizeSingleBook(chosen[0], {
                intent: previous.pendingIntent || 'book_detail',
                detailAspect: previous.pendingAspect || 'general',
                aspects: previous.pendingAspects,
                message,
                aiAvailable: false,
                remaining,
                context: { ...carriedContext(previous), candidateBookIds: undefined, pendingIntent: undefined, pendingAspect: undefined },
            });
        }
    }

    // 3. Fast-path for deterministic single-book factual lookups when title or context book is clear
    if (parsed && (['book_price', 'book_stock'].includes(parsed.intent)
        || (parsed.intent === 'book_detail' && ['author', 'category', 'rating', 'description'].includes(parsed.detailAspect)))) {
        const hasContextTarget = !parsed.title && (
            contextRefPattern.test(question)
            || ordinalIndex(question, lastIds) !== undefined
            || Number.isSafeInteger(previous.selectedBookId)
            || lastIds.length === 1
        );
        if (hasContextTarget) {
            return answerSingleBookIntent({
                intent: parsed.intent,
                detailAspect: parsed.detailAspect || 'general',
                aspects: local.aspects.length > 1 ? local.aspects : undefined,
                message,
                question,
                targetTitle: '',
                ai: null,
                aiAvailable: false,
                previous,
                lastIds,
                remaining,
                plainSource: 'template',
            });
        }
        if (parsed.title) {
            const directMatches = await findBooksByTitle(parsed.title, { inStockOnly: false });
            if (directMatches.length || !settings().apiKey || !settings().model) {
                return answerSingleBookIntent({
                    intent: parsed.intent,
                    detailAspect: parsed.detailAspect || 'general',
                    aspects: local.aspects.length > 1 ? local.aspects : undefined,
                    message,
                    question,
                    targetTitle: parsed.title,
                    ai: null,
                    aiAvailable: false,
                    previous,
                    lastIds,
                    remaining,
                    plainSource: 'template',
                    preloadedMatches: directMatches,
                });
            }
        }
    }

    const [categoryTree, { authors }] = await Promise.all([catalog.getCategories(), catalog.getFilterOptions()]);
    const categories = categoryTree.flatMap(category => [category, ...(category.children || [])]);
    const explicitComics = /\btruyen tranh\b/.test(question) && !/\bkhong (?:phai |muon )?truyen tranh\b/.test(question);
    const continuesComics = previous.genre === 'comics' && (local.keepSubject || local.priceUpdate
        || (local.budget.maxPrice !== undefined && !extractKeywords(message).length));
    const requestsComics = !parsed && (explicitComics || continuesComics);
    const comicsCategory = requestsComics && categories.find(item => normalize(item.category_name) === 'truyen tranh');
    if (requestsComics && !comicsCategory) {
        return respond(templates.noBooks, 'template', 'book_search', [], {
            genre: 'comics',
        });
    }
    const matchingItem = (items, key, value) => items.find(item => item[key] === value);
    const previousCategory = matchingItem(categories, 'category_id', previous.categoryId);
    const previousAuthor = matchingItem(authors, 'author_id', previous.authorId);
    const previousKeywords = shortList(previous.keywords, 30, 20).filter(word => /^[a-z]{2,30}$/.test(word));
    const previousPreferences = shortList(previous.preferences, 80, 5);
    const previousTitle = shortText(previous.title, 150);

    const statedTopic = message.trim().match(/^(?:(?:tìm|gợi ý)\s+)?sách\s+(?:về\s+)?([\p{L}][\p{L}\s-]{2,80})[?!.]*$/iu)?.[1].trim();
    const topicName = normalize(statedTopic);
    const categoryNames = categories.map(item => normalize(item.category_name));
    const broadTopic = topicName && !categoryNames.includes(topicName)
        && categoryNames.some(name => ` ${name} `.includes(` ${topicName} `)) ? statedTopic : undefined;

    const simpleDiscount = /^(?:co )?(?:sach|cuon|cuon sach) nao (?:dang )?giam gia(?: khong)?$/.test(question);
    const budgetBrowse = isBudgetBrowse(message);
    const backendOnly = simpleDiscount || budgetBrowse || local.discountStatus === 'regular' || local.discountStatus === 'any'
        || local.keepSubject || local.priceUpdate || Boolean(broadTopic) || Boolean(comicsCategory);
    const analysis = backendOnly ? { ok: false } : await interpretQuestion(message, {
        category: previousCategory?.category_name,
        author: previousAuthor?.author_name,
        keywords: previousKeywords,
        requiredKeywords: previous.requiredKeywords,
        preferences: previousPreferences,
        title: previousTitle,
        selectedBookId: previous.selectedBookId,
        maxPrice: validPrice(previous.maxPrice) ? previous.maxPrice : undefined,
        onSale: previous.onSale === true,
        discountStatus: previous.discountStatus,
        lastBookCount: lastIds.length,
        askedClarification: previous.askedClarification === true,
        pendingPrice: previous.pendingPrice === true,
    }, categories.map(item => item.category_name), remaining());
    const ai = analysis.ok ? analysis.data : null;
    const aiAvailable = analysis.ok;
    const plan = resolveRequest(local, ai);
    if (comicsCategory) plan.genreCategoryId = comicsCategory.category_id;
    const plainSource = aiAvailable || backendOnly ? 'template' : 'fallback';
    let intent = parsed?.intent || (local.keepSubject || local.priceUpdate ? 'follow_up'
        : local.discountStatus === 'sale' ? 'discount_search'
            : local.discountStatus ? 'book_search' : ai?.intent || localIntent(question, previous, parsed));
    if (ordinalPattern.test(question) && lastIds.length && !['book_price', 'book_stock', 'book_detail'].includes(intent)) {
        intent = 'book_detail';
    }

    if (intent === 'greeting' || intent === 'out_of_scope') {
        const reply = safeText(ai?.reply, 400);
        const fallback = intent === 'greeting' ? pick(templates.greeting) : templates.outOfScope;
        return respond(reply || fallback, reply ? analysis.provider : plainSource, intent, [], carriedContext(previous));
    }
    if (intent === 'policy_question') {
        if (loadDocuments) {
            const { reply, sources } = await answerPolicy(message, loadDocuments);
            return { ...respond(reply, 'template', intent, [], carriedContext(previous)), sources };
        }
        return respond(templates.policy, 'template', intent, [], carriedContext(previous));
    }

    const similarToTitle = parsed?.similarToTitle || shortText(ai?.similarToTitle, 150);
    if (similarToTitle) {
        return recommendSimilarBooks({
            similarToTitle, message, aiAvailable, previous, categories, remaining, plainSource,
        });
    }

    const quotedTitle = message.match(/["“]([^"”]{1,150})["”]/)?.[1];
    if (['book_price', 'book_stock', 'book_detail'].includes(intent)) {
        const targetTitle = cleanExtractedTitle(quotedTitle || shortText(plan.title, 150));
        const detailAspect = parsed?.detailAspect || ai?.detailAspect || 'general';
        return answerSingleBookIntent({
            intent, detailAspect, aspects: plan.aspects, message, question, targetTitle, ai, aiAvailable, previous, lastIds, remaining, plainSource,
        });
    }

    return recommendFromCatalog({
        message, question, intent, ai, aiAvailable, previous, categories, authors,
        previousCategory, previousAuthor, previousTitle, previousKeywords, previousPreferences,
        quotedTitle, plainSource, deadline, remaining, aiSource: analysis.provider, budgetBrowse, plan, broadTopic,
    });
}

module.exports = { recommend, answerTurn: recommend };
