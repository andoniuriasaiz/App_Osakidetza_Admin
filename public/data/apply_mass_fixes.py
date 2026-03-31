import json
import os
import glob

# Data correction maps (originalId -> (new_ans_letter, explanation))
# Letter to index: A=1, B=2, C=3, D=4

corrections = {
    # CAPA 1 - RED FLAGS (isSoloApp)
    "aux-e03.json": {
        160: ("B", "Art. 22.1 Ley 39/2015: suspensión por pruebas técnicas contradictorias, no por solicitud del interesado.")
    },
    "aux-e04.json": {
        175: ("B", "Art. 123.2 Ley 39/2015: el recurso potestativo de reposición impide acudir a lo contencioso hasta resolución."),
        177: ("B", "Art. 122.2 Ley 39/2015: silencio en recurso de alzada = desestimación, no caducidad."),
        174: ("C", "Art. 123 Ley 39/2015: reposición contra actos que ponen fin vía administrativa."),
        180: ("C", "Art. 125 Ley 39/2015: revisión por documentos esenciales ignorados."),
        120: ("A", "Decreto 255/1997: las revisiones de oficio y recursos extraordinarios corresponden a la Presidencia o Director General.")
    },
    "aux-e12.json": {
        41: ("C", "Art. 4.4 Ley 31/1995: riesgo grave e inminente requiere probable materialización inmediata Y daño grave."),
        59: ("C", "Art. 13 Ley 31/1995: la CNSST está integrada por UN representante de cada una de las CCAA.")
    },
    "comun-t01.json": {
        8: ("A", "La Ley 44/2003 remite expresamente a la Ley 41/2002 para el derecho de información."),
        9: ("B", "La dispensación de medicamentos es función del farmacéutico (incorrecta para médico)."),
        17: ("C", "C es el principio falso: no existe deber de informar sobre demandas de responsabilidad administrativa."),
        1: ("A", "Art. 2 Ley 44/2003: la colegiación es requisito imprescindible cuando una ley estatal la establezca.")
    },
    "comun-t02.json": {
        21: ("B", "Art. 2 Ley 16/2003: aplicación a servicios públicos y privados en seguridad y calidad."),
        24: ("A", "Art. 8bis SNS: tres modalidades (básica, suplementaria, accesorios)."),
        28: ("A", "Servicios accesorios sujetos a aportación y/o reembolso."),
        30: ("A", "Art. 20.2: las CCAA SÍ deben informar motivadamente al CISNS."),
        32: ("B", "La Red de Agencias de ETS participa en la evaluación, no es preceptiva solitariamente."),
        33: ("A", "Exclusión solo procede por falta de eficacia/eficiencia o balance riesgo desfavorable."),
        36: ("A", "Art. 37: la Comisión de RRHH del SNS diseña programas de formación."),
        25: ("B", "Art. 8bis: la cartera básica se aprueba por Real Decreto."),
        26: ("D", "Cartera básica = asistenciales + transporte urgente. Farmacia/Ortoprotésica son suplementaria."),
        35: ("B", "Financiación medicamentos = competencia Ministerio de Sanidad.")
    },
    "comun-t05.json": {
        93: ("B", "El Decreto 255/1997 remite a la Ley 8/1997 de Ordenación Sanitaria de Euskadi."),
        99: ("B", "Las compras centralizadas corresponden a la organización central de Osakidetza."),
        89: ("B", "Decreto 255/1997: el equipo directivo cuenta con TRES Direcciones de División.")
    },
    "comun-t08.json": {
        142: ("C", "Art. 3 Ley 41/2002: definición de usuario vs paciente sin restricción a sistema público."),
        144: ("C", "Art. 4: información mínima incluye consecuencias."),
        149: ("C", "Art. 9.3: consentimiento por representación como regla general en menores."),
        150: ("C", "Art. 10.1.a: información incluye riesgos probables."),
        155: ("C", "Art. 21.2: la dirección del centro oye al paciente y acude a la autoridad judicial.")
    },
    "comun-t09.json": {
        158: ("C", "Objetivos vitales sirven para interpretar instrucciones y orientar decisiones clínicas."),
        163: ("C", "Art. 7 Ley 7/2002: testigos deben ser mayores de edad (18) y cumplir grados."),
        166: ("C", "Prevalece voluntad inequívoca ante interlocutor."),
        169: ("C", "Art. 12: la interconexión del Registro no precisa consentimiento adicional."),
        159: ("A", "Art. 6 Ley 7/2002: representante para cualquier supuesto de incapacidad de expresión."),
        161: ("A", "Art. 5: instrucciones para enfermedad presente o futura."),
        167: ("A", "Art. 9: no puestas cuando contrarias al ordenamiento en momento de APLICACIÓN."),
        170: ("A", "Art. 11: DVA no inscrito ES válido si se aporta."),
        162: ("C", "Procedimientos: Registro/Centros + 2 testigos."),
        165: ("B", "Modificación formalizada por mismos cauces que otorgamiento (escrito).")
    },
    "comun-t10.json": {
        175: ("B", "Art. 10 LO 3/2018: tratamiento de datos penales por abogacía y procura.")
    },
    "comun-t12.json": {
        193: ("C", "Autosuficiencia presupuestaria no es principio rector del Plan Salud 2030."),
        200: ("C", "Objetivo central: reducir morbimortalidad evitable y desigualdades.")
    },
    "comun-t15.json": {
        247: ("D", "Capacitación en igualdad = formación obligatoria de todo el personal.")
    },
    "comun-t16.json": {
        257: ("C", "Mensajes audiovisuales: bilingües, euskera primero."),
        258: ("B", "Prohibición absoluta de una sola lengua es incorrecta por excepciones."),
        259: ("C", "Obligación de registrar idioma de preferencia oral del paciente."),
        265: ("A", "La competencia de quejas lingüísticas no suele ser de RRHH."),
        266: ("A", "Designar interlocutores vascoparlantes con proveedores."),
        267: ("B", "Comunicación interna anual sobre lengua preferente.")
    },
    "comun-t18.json": {
        286: ("C", "Art. 17: la Comisión de Garantía y Evaluación verifica previo a la prestación."),
        288: ("C", "Art. 16: derecho a la objeción de conciencia del personal implicado.")
    },
    "aux-e11.json": {
        33: ("C", "Diagnóstico confirmatorio -> centro de origen."),
        34: ("B", "Diagnóstico NO confirmatorio -> libertad de elección de centro."),
        30: ("B", "Plazo de 10 días hábiles para citación segunda opinión.")
    },
    "aux-e06.json": {
        90: ("A", "El EBEP rige los permisos de nacimiento/lactancia del personal laboral público.")
    },
    "aux-e08.json": {
        117: ("D", "Situaciones administrativas en el Acuerdo Osakidetza: todas las anteriores.")
    },
    "comun-t04.json": {
        102: ("D", "OSI = Atención Primaria + Atención Hospitalaria."),
        95: ("D", "Equipo directivo: máximo de cinco personas."),
        87: ("A", "La Dirección General formula la propuesta del Plan Estratégico."),
        124: ("A", "Ámbitos D.147/2015 incluyen investigación biomédica.")
    }
}

base_path = "public/data/"

def apply_fixes():
    for filename, fixes in corrections.items():
        filepath = os.path.join(base_path, filename)
        if not os.path.exists(filepath):
            print(f"Warning: {filepath} not found")
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        modified = False
        for q in data:
            orig_id = q.get('originalId')
            if orig_id in fixes:
                letter, expl = fixes[orig_id]
                val_map = {"A": 1, "B": 2, "C": 3, "D": 4}
                val = val_map[letter]
                
                # Get the text of the correct option
                option_text = ""
                for opt in q['options']:
                    if opt['value'] == val:
                        option_text = opt['text']
                        break
                
                print(f"Fixing {filename} Q{orig_id}: {q.get('correctAnswerNums')} -> [{val}]")
                q['correctAnswerNums'] = [val]
                q['correctAnswers'] = [option_text]
                q['explanation'] = expl
                modified = True
                
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Saved {filepath}")

if __name__ == "__main__":
    apply_fixes()
