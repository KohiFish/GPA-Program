const cheerio = require('cheerio');
const fs = require('fs');
const LOGIN_PATH = '/HomeAccess/Account/LogOn';
const ASSIGNMENT_PATH = '/HomeAccess/Classes/Classwork';

function toNumber(text) {
    const n = parseFloat(String(text ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isNaN(n) ? null : n;
}

function readTable($, table) {
    const headers = $(table).find('th')
        .map((_, th) => $(th).text().replace(/\s+/g, ' ').trim().toLowerCase())
        .get();
    const rows = [];
    $(table).find('tr').each((_, tr) => {
        const cells = $(tr).children('td');
        if (!cells.length) return;
        const row = {};
        cells.each((i, td) => {
            row[headers[i] || `col${i}`] = $(td).text().replace(/\s+/g, ' ').trim();
        });
        rows.push(row);
    });
    return { headers, rows };
}

function find(row, pattern) {
    const key = Object.keys(row).find((k) => pattern.test(k));
    return key ? row[key] : '';
}

async function login(fetchFn, baseUrl, user, pass) {
    const loginUrl = baseUrl + LOGIN_PATH;
    const res = await fetchFn(loginUrl, { credentials: 'include' });
    const $ = cheerio.load(await res.text());
    const form = $('input[type="password"]').first().closest('form');
    if (!form.length) throw new Error('Could not find the login form. Is the URL right?');
    const body = new URLSearchParams();
    form.find('input[name]').each((_, el) => {
        const type = ($(el).attr('type') || 'text').toLowerCase();
        if (['submit', 'button', 'image'].includes(type)) return;
        if (['checkbox', 'radio'].includes(type) && !$(el).is(':checked')) return;
        body.set($(el).attr('name'), $(el).attr('value') ?? '');
    });
    form.find('select[name]').each((_, el) => {
        const selected = $(el).find('option[selected]').first();
        const opt = selected.length ? selected : $(el).find('option').first();
        body.set($(el).attr('name'), opt.attr('value') ?? '');
    });

    const passName = 'LogOnDetails.Password';
    const userName =
        form.find('input[name]').filter((_, el) => /user/i.test($(el).attr('name'))).first().attr('name') ||
        form.find('input[type="text"][name]').first().attr('name');
    body.set(userName, user);
    body.set(passName, pass);
    body.set('tempUN', user);
    body.set('tempPW', pass);
    if (process.env.DEV) console.log('userName field', userName, '| passName field:', passName, '| password length:', pass.length);
    const action = new URL(form.attr('action') || LOGIN_PATH, loginUrl).toString();
    const resp = await fetchFn(action, {
        method: 'POST',
        body,
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const html = await resp.text();
    if (process.env.DEV) {
        console.log('Fields sent:', [...body.keys()]);
        console.log('Posted to:', action);
        console.log('Ended at:', resp.url);
        fs.writeFileSync('debug-login.html', html);
    }

    const after = cheerio.load(html);
    if (after('input[type="password"]').length) {
        const msg = after('.validation-summary-errors, .field-validation-error')
            .text().replace(/\s+/g, ' ').trim();
        throw new Error('Login failed: ' + (msg || 'HAC gave no message'));
    }
}

async function fetchGrades(fetchFn, baseUrl, user, pass) {
    await login(fetchFn, baseUrl, user, pass);
    const page = await fetchFn(baseUrl + ASSIGNMENT_PATH, { credentials: 'include' });
    const html = await page.text();
    if (process.env.DEV) fs.writeFileSync('debug-assignments.html', html);
    const $ = cheerio.load(html);
    const classes = [];

    $('.AssignmentClass').each((_, block) => {
        const name = $(block).find('.sg-header-heading').first().text().replace(/\s+/g, ' ').trim();
        const averageText = $(block).find('.sg-header-sub-heading').first().text().replace(/\s+/g, ' ').trim();
        const assignments = [];
        const categories = [];

        $(block).find('table.sg-asp-table').each((_, table) => {
            const { headers, rows } = readTable($, table);
            if (headers.includes('assignment')) {
                for (const r of rows) {
                    assignments.push({
                        name: r['assignment'],
                        category: r['category'],
                        dueDate: r['date due'],
                        earned: toNumber(r['score']),
                        possible: toNumber(r['total points']),
                    });
                }
            } else if (headers.includes('category')) {
                for (const r of rows) {
                    categories.push({
                        name: r['category'],
                        weight: toNumber(find(r, /weight/)),
                        percent: toNumber(find(r, /percent/)),
                    });
                }
            }
        });
        classes.push({ name, averageText, categories, assignments });
    });
    return classes;
}

module.exports = { fetchGrades };