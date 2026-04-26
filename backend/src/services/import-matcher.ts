import { AppDataSource } from '../config/database'
import { ImportRule } from '../entities/ImportRule'
import { Counterparty } from '../entities/Counterparty'
import { Category } from '../entities/Category'
import { NormalizedRow } from './bank-parsers/types'

export interface MatchSuggestion {
  counterparty_id: string | null
  counterparty_name: string | null
  category_id: string | null
  category_name: string | null
  is_inter_transfer: boolean
  matched_rule_id: string | null
  match_quality: 'inn' | 'name' | 'description' | 'none'
}

export async function suggestMatch(row: NormalizedRow): Promise<MatchSuggestion> {
  const ruleRepo = AppDataSource.getRepository(ImportRule)
  const cpRepo   = AppDataSource.getRepository(Counterparty)
  const catRepo  = AppDataSource.getRepository(Category)

  // 1. By INN — most reliable
  if (row.counterparty_inn) {
    const rule = await ruleRepo.findOne({
      where: { match_type: 'inn', match_value: row.counterparty_inn },
    })
    if (rule) {
      const [cp, cat] = await Promise.all([
        rule.counterparty_id ? cpRepo.findOne({ where: { id: rule.counterparty_id } }) : null,
        rule.category_id ? catRepo.findOne({ where: { id: rule.category_id } }) : null,
      ])
      return {
        counterparty_id: cp?.id || null,
        counterparty_name: cp?.name || null,
        category_id: cat?.id || null,
        category_name: cat?.name || null,
        is_inter_transfer: rule.is_inter_transfer,
        matched_rule_id: rule.id,
        match_quality: 'inn',
      }
    }
    // Direct counterparty match by INN even if no rule
    const cp = await cpRepo.findOne({ where: { inn: row.counterparty_inn } })
    if (cp) {
      return {
        counterparty_id: cp.id,
        counterparty_name: cp.name,
        category_id: null, category_name: null,
        is_inter_transfer: false, matched_rule_id: null,
        match_quality: 'inn',
      }
    }
  }

  // 2. By description keyword (substring match)
  const descRules = await ruleRepo.find({ where: { match_type: 'description_keyword' } })
  const descLower = row.description.toLowerCase()
  for (const rule of descRules) {
    if (descLower.includes(rule.match_value.toLowerCase())) {
      const [cp, cat] = await Promise.all([
        rule.counterparty_id ? cpRepo.findOne({ where: { id: rule.counterparty_id } }) : null,
        rule.category_id ? catRepo.findOne({ where: { id: rule.category_id } }) : null,
      ])
      return {
        counterparty_id: cp?.id || null,
        counterparty_name: cp?.name || null,
        category_id: cat?.id || null,
        category_name: cat?.name || null,
        is_inter_transfer: rule.is_inter_transfer,
        matched_rule_id: rule.id,
        match_quality: 'description',
      }
    }
  }

  // 3. By name keyword
  const nameRules = await ruleRepo.find({ where: { match_type: 'name_keyword' } })
  const nameLower = row.counterparty_name.toLowerCase()
  for (const rule of nameRules) {
    if (nameLower.includes(rule.match_value.toLowerCase())) {
      const [cp, cat] = await Promise.all([
        rule.counterparty_id ? cpRepo.findOne({ where: { id: rule.counterparty_id } }) : null,
        rule.category_id ? catRepo.findOne({ where: { id: rule.category_id } }) : null,
      ])
      return {
        counterparty_id: cp?.id || null,
        counterparty_name: cp?.name || null,
        category_id: cat?.id || null,
        category_name: cat?.name || null,
        is_inter_transfer: rule.is_inter_transfer,
        matched_rule_id: rule.id,
        match_quality: 'name',
      }
    }
  }

  return {
    counterparty_id: null, counterparty_name: null,
    category_id: null, category_name: null,
    is_inter_transfer: false, matched_rule_id: null,
    match_quality: 'none',
  }
}
