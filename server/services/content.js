import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBank } from '../../shared/quiz.js';
import { SOURCES } from '../../shared/sources.js';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content/questions.seed.json');
const bank = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = validateBank(bank, new Set(Object.keys(SOURCES)));
if (errors.length) throw new Error(`Banco de perguntas inválido: ${errors.join('; ')}`);

export const QUESTIONS = bank.questions;
export const CONTENT_VERSION = bank.contentVersion;
