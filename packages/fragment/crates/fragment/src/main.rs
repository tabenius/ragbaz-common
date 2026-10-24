use ragbaz_fragment::*;
use serde_json::Value;
use std::{
    env, fs,
    io::{self, Read},
};
fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().skip(1).collect();
    let command = args.first().map(String::as_str).unwrap_or("validate");
    let mut input = String::new();
    if let Some(path) = args.get(1) {
        input = fs::read_to_string(path).map_err(|e| e.to_string())?;
    } else {
        io::stdin()
            .read_to_string(&mut input)
            .map_err(|e| e.to_string())?;
    }
    let v = parse(&input)?;
    let errors = validate(&v);
    if !errors.is_empty() {
        return Err(errors.join("\n"));
    }
    let result = match command {
        "validate" => serde_json::json!({"valid":true,"unresolved":unresolved(&v)}),
        "json" => v.clone(),
        "ast" => ast(&v, ""),
        "yaml" => {
            print!(
                "{}",
                serde_yaml_ng::to_string(&v).map_err(|e| e.to_string())?
            );
            return Ok(());
        }
        "evaluate" => {
            let path = args
                .get(2)
                .ok_or("evaluate needs an environment.json file")?;
            let env: Value =
                serde_json::from_str(&fs::read_to_string(path).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            evaluate(
                &v,
                &env,
                args.get(3).map(String::as_str).unwrap_or("screen"),
            )
        }
        "bind" => {
            let path = args.get(2).ok_or("bind needs bindings.json")?;
            let bindings: Value =
                serde_json::from_str(&fs::read_to_string(path).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            let mut m = v.clone();
            m["bindings"] = bindings;
            let e = validate(&m);
            if !e.is_empty() {
                return Err(e.join("\n"));
            }
            m
        }
        "template" => {
            let path = args.get(2).ok_or("template needs a Jinja template file")?;
            let source = fs::read_to_string(path).map_err(|e| e.to_string())?;
            let mut engine = minijinja::Environment::new();
            engine.set_undefined_behavior(minijinja::UndefinedBehavior::Strict);
            let output = engine.render_str(&source, &v).map_err(|e| e.to_string())?;
            print!("{output}");
            return Ok(());
        }
        _ => {
            return Err(
                "Commands: validate | json | yaml | ast | evaluate | bind | template".into(),
            )
        }
    };
    println!("{}", serde_json::to_string_pretty(&result).unwrap());
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{e}");
        std::process::exit(1);
    }
}
