//! Fragment 0.1: no I/O, network, browser, or LLM in the protocol core.
use regex::Regex;
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub fn parse(source: &str) -> Result<Value, String> {
    if source.len() > 1_000_000 {
        return Err("Input exceeds 1 MB".into());
    }
    use yaml_rust2::scanner::{Scanner, TokenType};
    let mut scanner = Scanner::new(source.chars());
    for token in scanner.by_ref() {
        if matches!(
            token.1,
            TokenType::Alias(_)
                | TokenType::Anchor(_)
                | TokenType::Tag(_, _)
                | TokenType::TagDirective(_, _)
        ) {
            return Err("Anchors, aliases and explicit tags are unsupported".into());
        }
    }
    if let Some(e) = scanner.get_error() {
        return Err(e.to_string());
    }
    // YAML Value's map visitor rejects duplicate keys before JSON conversion.
    let yaml: serde_yaml_ng::Value = serde_yaml_ng::from_str(source).map_err(|e| e.to_string())?;
    yaml_check(&yaml, 0)?;
    let v: Value = serde_json::to_value(yaml).map_err(|e| e.to_string())?;
    tree_check(&v, 0)?;
    Ok(v)
}
fn yaml_check(v: &serde_yaml_ng::Value, d: usize) -> Result<(), String> {
    if d > 64 {
        return Err("Maximum depth is 64".into());
    }
    match v {
        serde_yaml_ng::Value::Mapping(m) => {
            for (k, v) in m {
                if !matches!(k, serde_yaml_ng::Value::String(_)) {
                    return Err("Mapping keys must be strings".into());
                }
                yaml_check(v, d + 1)?;
            }
        }
        serde_yaml_ng::Value::Sequence(a) => {
            for v in a {
                yaml_check(v, d + 1)?;
            }
        }
        serde_yaml_ng::Value::Number(n) => {
            if n.as_f64().is_none_or(|f| !f.is_finite()) {
                return Err("Non-finite number".into());
            }
        }
        _ => (),
    }
    Ok(())
}
fn tree_check(v: &Value, d: usize) -> Result<(), String> {
    if d > 64 {
        return Err("Maximum depth is 64".into());
    }
    match v {
        Value::Object(o) => {
            for (k, v) in o {
                if ["__proto__", "constructor", "prototype", "<<"].contains(&k.as_str()) {
                    return Err(format!("Reserved key: {k}"));
                }
                tree_check(v, d + 1)?;
            }
        }
        Value::Array(a) => {
            for v in a {
                tree_check(v, d + 1)?;
            }
        }
        Value::Number(n) => {
            let f = n.as_f64().ok_or("Invalid number")?;
            if !f.is_finite() || (f.fract() == 0.0 && f.abs() > 9007199254740991.0) {
                return Err("Numbers must be JSON-safe".into());
            }
        }
        _ => (),
    }
    Ok(())
}
pub fn validate(v: &Value) -> Vec<String> {
    if let Err(e) = tree_check(v, 0) {
        return vec![e];
    }
    let schema: Value = serde_json::from_str(include_str!("../../../schema.json")).unwrap();
    let validator = jsonschema::options()
        .should_validate_formats(true)
        .build(&schema)
        .unwrap();
    let mut errors: Vec<String> = validator.iter_errors(v).map(|e| e.to_string()).collect();
    if !errors.is_empty() {
        return errors;
    }
    let zone = v["meta"]["timezone"]
        .as_str()
        .unwrap()
        .parse::<chrono_tz::Tz>();
    let date = chrono::DateTime::parse_from_rfc3339(v["meta"]["created"].as_str().unwrap());
    match (zone, date) {
        (Ok(z), Ok(d)) => {
            if d.format("%:z").to_string() != d.with_timezone(&z).format("%:z").to_string() {
                errors.push("Timestamp offset does not match timezone at this instant".into());
            }
        }
        _ => errors.push("Invalid timezone or timestamp".into()),
    }
    for target in ["screen", "print"] {
        let req: Vec<&str> = v["constraints"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|c| c["level"] == "require" && (c["scope"] == "all" || c["scope"] == target))
            .map(|c| c["capability"].as_str().unwrap())
            .collect();
        for (a, b) in [("color", "monochrome"), ("portrait", "landscape")] {
            if req.contains(&a) && req.contains(&b) {
                errors.push(format!("{a} and {b} conflict for {target}"));
            }
        }
    }
    let mut ids = BTreeSet::new();
    for b in v["blocks"].as_array().unwrap() {
        if !ids.insert(b["id"].as_str().unwrap()) {
            errors.push("Duplicate block id".into());
        }
        if b["type"] == "quiz" {
            let count = b["options"].as_array().map_or(0, |a| a.len());
            if count == 0 || b["answer"].as_u64().is_none_or(|a| a as usize >= count) {
                errors.push("Invalid quiz answer/options".into());
            }
        }
        if b["type"] == "figure-group" && b["figures"].as_array().is_none_or(|a| a.is_empty()) {
            errors.push("Figure group needs figures".into());
        }
    }
    let mut nodes = BTreeSet::new();
    for n in v["graph"]["nodes"].as_array().unwrap() {
        if !nodes.insert(n["id"].as_str().unwrap()) {
            errors.push("Duplicate graph node".into());
        }
    }
    for e in v["graph"]["edges"].as_array().unwrap() {
        if !nodes.contains(e["source"].as_str().unwrap())
            || !nodes.contains(e["target"].as_str().unwrap())
        {
            errors.push("Missing edge endpoint".into());
        }
    }
    if v["kind"] == "document" && !unresolved(v).is_empty() {
        errors.push("Documents must bind all placeholders".into());
    }
    errors
}
fn pattern() -> Regex {
    Regex::new(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}").unwrap()
}
pub fn bind_text(text: &str, bindings: &Value) -> String {
    pattern()
        .replace_all(text, |c: &regex::Captures| {
            let k = &c[1];
            match bindings.get(k) {
                None | Some(Value::Null) => format!("⟦{k} · unbound⟧"),
                Some(Value::String(s)) => s.clone(),
                Some(v) => v.to_string(),
            }
        })
        .into_owned()
}
pub fn unresolved(v: &Value) -> Vec<String> {
    let mut keys = BTreeSet::new();
    for b in v["blocks"].as_array().into_iter().flatten() {
        let mut texts = vec![
            b["title"].as_str().unwrap_or(""),
            b["text"].as_str().unwrap_or(""),
        ];
        for f in b["figures"].as_array().into_iter().flatten() {
            for k in ["label", "value", "explanation"] {
                texts.push(f[k].as_str().unwrap_or(""));
            }
        }
        for o in b["options"].as_array().into_iter().flatten() {
            texts.push(o.as_str().unwrap_or(""));
        }
        for t in texts {
            for c in pattern().captures_iter(t) {
                if v["bindings"].get(&c[1]).is_none_or(Value::is_null) {
                    keys.insert(c[1].to_owned());
                }
            }
        }
    }
    keys.into_iter().collect()
}
pub fn evaluate(v: &Value, env: &Value, target: &str) -> Value {
    let issues: Vec<Value> = v["constraints"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|c| {
            (c["scope"] == "all" || c["scope"] == target)
                && env[c["capability"].as_str().unwrap()] != true
        })
        .map(|c| {
            let mut c = c.clone();
            c["observed"] = json!(if env[c["capability"].as_str().unwrap()] == false {
                "absent"
            } else {
                "unknown"
            });
            c["severity"] = json!(if c["level"] == "require" {
                "blocked"
            } else {
                "degraded"
            });
            c
        })
        .collect();
    json!({"status":if issues.iter().any(|i|i["severity"]=="blocked"){"blocked"}else if issues.is_empty(){"ready"}else{"degraded"},"issues":issues})
}
pub fn ast(v: &Value, path: &str) -> Value {
    match v {
        Value::Object(o) => {
            json!({"path":path,"type":"object","children":o.iter().map(|(k,v)|ast(v,&format!("{}/{}",path,k.replace('~',"~0").replace('/',"~1")))).collect::<Vec<_>>()})
        }
        Value::Array(a) => {
            json!({"path":path,"type":"array","children":a.iter().enumerate().map(|(i,v)|ast(v,&format!("{path}/{i}"))).collect::<Vec<_>>()})
        }
        _ => {
            json!({"path":path,"type":match v{Value::Null=>"null",Value::Bool(_)=>"boolean",Value::Number(_)=>"number",_=>"string"},"value":v})
        }
    }
}
pub fn resolve_theme(slug: &str) -> Value {
    let themes: Vec<Value> = serde_json::from_str(include_str!("../../../themes.json")).unwrap();
    if let Some(t) = themes.iter().find(|t| t["resolved"] == slug) {
        return t.clone();
    }
    let terms: Vec<_> = slug.split('-').collect();
    let mut best = 0;
    let mut score = -1.0;
    for (i, t) in themes.iter().enumerate() {
        let parts: Vec<_> = t["resolved"].as_str().unwrap().split('-').collect();
        let s: f64 = terms
            .iter()
            .enumerate()
            .map(|(j, k)| {
                if parts.contains(k) {
                    2f64.powi(-(j as i32))
                } else {
                    0.0
                }
            })
            .sum();
        if s > score {
            score = s;
            best = i;
        }
    }
    let mut t = themes[best].clone();
    t["requested"] = json!(slug);
    t["provenance"]=json!("Approximate weighted token match; registry order breaks ties. Inspect resolved slug and tokens.");
    t
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn conflict_and_unknown() {
        let mut v: Value =
            serde_json::from_str(include_str!("../../../examples/draft.json")).unwrap();
        assert!(validate(&v).is_empty());
        v["constraints"] = json!([{"capability":"color","level":"require","scope":"all","reason":"a"},{"capability":"monochrome","level":"require","scope":"all","reason":"b"}]);
        assert!(!validate(&v).is_empty());
        assert_eq!(evaluate(&v, &json!({}), "print")["status"], "blocked");
    }
    #[test]
    fn binding_is_data() {
        assert_eq!(bind_text("{{ x }}", &json!({"x":"<script>"})), "<script>");
        assert_eq!(bind_text("{{ x }}", &json!({})), "⟦x · unbound⟧");
    }
}
