# Glosario / taxonomía RV — referencia

Fuente: catálogo experto del dueño (v1.0). Es la base de la **taxonomía RV del matching**
(ver `docs/adr/0006-rv-taxonomy-matching.md`) y será el **conocimiento del chat** en la Fase B.
Texto extraído del PDF original; conservado aquí para que viva en el repo (buscable, versionable).

---

Catalogo experto - Glosario tecnico de campers y autocaravanas
Preparado para CRM de stock y preferencias de cliente
CATALOGO EXPERTO
Glosario tecnico de campers y autocaravanas
Taxonomia para CRM, matching de stock y argumentario comercial
Objetivo del documento
Este documento sirve para nutrir un CRM de compraventa/alquiler de campers y autocaravanas con lenguaje real del
sector: terminos tecnicos, nombres comerciales, sinonimos de cliente, atributos de stock, preferencias de compra y reglas
de matching.
Enfoque: convertir cada consulta de cliente en campos estructurados: necesito, deseo, descarto, uso, presupuesto, estilo y restricciones
tecnicas.
Version: 1.0 - Preparado para Joel Martinez
Catalogo experto - Glosario tecnico de campers y autocaravanas
Preparado para CRM de stock y preferencias de cliente
Indice operativo
 1. Mapa mental del comprador: como piensa y como habla
 2. Tipos de vehiculo y carrocerias
 3. Bases, chasis, medidas y codigos L/H
 4. Pesos, legalidad, carnet y homologacion
 5. Distribuciones interiores y layouts
 6. Camas y zonas de descanso
 7. Banos, duchas y WC
 8. Cocina, gas y electrodomesticos
 9. Sistema electrico, baterias y autonomia off-grid
 10. Agua, fontaneria y depositos
 11. Calefaccion, climatizacion y uso en invierno
 12. Aislamiento, construccion y materiales
 13. Estilos de interior y acabados
 14. Exterior, toldos, portabicis y equipamiento
 15. Off-road, overland y aventura
 16. Almacenamiento, garaje y material deportivo
 17. Conduccion, seguridad y cabina
 18. Marcas, fabricantes y componentes
 19. Frases reales de busqueda y equivalencias CRM
 20. Taxonomia recomendada para CRM
 21. Reglas de matching y scoring
 22. Checklist de alta de stock
 23. Fuentes consultadas
Catalogo experto - Glosario tecnico de campers y autocaravanas
Preparado para CRM de stock y preferencias de cliente

1. Mapa mental del comprador
   En este mercado no se compra solo un vehiculo. Se compra una forma de viajar. Por eso el CRM debe entender tres capas:
   necesidad funcional, restriccion tecnica y deseo emocional.
   Capa Pregunta real del cliente Traduccion CRM
   Necesidad funcional Somos 4 y queremos viajar comodos. plazas_viaje >= 4, plazas_dormir >= 4,
   almacenamiento alto
   Restriccion tecnica Tiene que entrar en mi parking. altura_maxima, longitud_maxima, anchura
   Deseo emocional Me gusta estilo madera clara, moderno y
   luminoso.
   interior_style = scandinavian / japandi,
   wood_tone = light
   Miedo de compra No quiero problemas de ITV ni
   homologacion.
   homologation_required = true,
   documents_available = true
   Uso real Quiero estar varios dias sin camping. off_grid_days_target, lithium, solar_watts,
   water_capacity
2. Tipos de vehiculo y carrocerias
   Termino Descripcion experta Como lo dice el cliente Campo CRM
   Mini camper Vehiculo pequeno tipo Berlingo,
   Kangoo, Caddy o similar con
   modulo cama/cocina basico.
   camper pequena, mini camper,
   para escapadas
   vehicle_category=mini_camper
   Camper compacta Furgo tipo VW Transporter,
   Vito, Transit Custom. Puede
   tener techo elevable.
   tipo California, para diario, que
   entre en parking
   vehicle_category=compact_ca
   mper
   Pop-top / techo elevable Techo que se eleva para ganar
   altura y/o una cama superior.
   techo elevable, cama arriba roof_type=pop_top
   Gran volumen Furgon grande camperizado
   tipo Ducato, Boxer, Jumper,
   Sprinter, Crafter.
   6 metros con bano, L2H2, L3H2 vehicle_category=panel_van_c
   onversion
   Perfilada Autocaravana con cabina
   original y celula mas
   aerodinamica que capuchina.
   perfilada para pareja vehicle_category=low_profile
   Capuchina Autocaravana con cama sobre
   cabina. Muy familiar por
   numero de camas.
   capuchina, para 5 o 6 vehicle_category=overcab
   Integral / A-Class Cabina y vivienda integradas
   en una carroceria completa.
   Gama alta.
   integral, Hymer, premium vehicle_category=a_class
   Overland / expedition Preparacion robusta para rutas
   remotas, 4x4, autonomia y
   exterior tecnico.
   camper 4x4, aventura, off-road vehicle_category=expedition
   Caravana Remolque vivienda sin motor.
   Requiere vehiculo tractor.
   caravana familiar vehicle_category=caravan
   Teardrop Remolque camper pequeno
   con cama y cocina trasera
   exterior.
   mini caravana, remolque
   pequeno
   vehicle_category=teardrop
3. Bases, chasis, medidas y codigos L/H
   La base del vehiculo condiciona longitud, altura, carga util, fiabilidad percibida, traccion, recambios, precio y tipo de distribucion
   posible.
   Base / modelo Lectura comercial Busqueda habitual
   Fiat Ducato Estandar europeo en campers gran
   volumen y autocaravanas. Mucha oferta y
   recambios.
   Ducato L2H2, Ducato L3H2 camper
   Citroen Jumper / Peugeot Boxer Muy similares a Ducato; buena relacion
   precio/equipamiento.
   Boxer camper, Jumper camperizada
   Mercedes Sprinter Percepcion premium, versiones traccion
   trasera/4x4, muy usado en overland.
   Sprinter 4x4 camper, Sprinter L2H2
   VW Crafter / MAN TGE Base grande moderna; asociada a Crafter 4Motion camper, MAN TGE camper
   Catalogo experto - Glosario tecnico de campers y autocaravanas
   Preparado para CRM de stock y preferencias de cliente
   preparaciones premium.
   Ford Transit Cada vez mas usada; buena conduccion y
   red de servicio.
   Transit camper, Transit Trail
   VW Transporter T5/T6/T7 Compacta aspiracional; valor residual alto. VW California, T6 camper
   Mercedes Vito / Clase V Alternativa premium compacta; Marco Polo
   como referencia.
   Mercedes Marco Polo, Vito camper
   Ford Transit Custom Compacta moderna; Ford Nugget como
   referencia.
   Ford Nugget, Custom camper
   Iveco Daily Robusta, chasis de carga, traccion trasera
   y versiones 4x4.
   Iveco Daily 4x4 camper
   Codigo Significado Uso en CRM
   L1/L2/L3/L4 Longitud de carroceria: corta, media, larga,
   extra larga.
   body_length_code
   H1/H2/H3 Altura de techo: bajo, alto, super alto. roof_height_code
   SWB/MWB/LWB/XLWB Batalla corta, media, larga y extra larga. wheelbase
   FWD/RWD/AWD/4x4 Traccion delantera, trasera, total o 4x4. drive_type
   Chasis cabina Cabina + bastidor para montar celula de
   autocaravana.
   chassis_type=cab_chassis
   Chasis AL-KO Chasis rebajado y especializado habitual
   en autocaravanas.
   chassis_brand=ALKO
   Doble eje / twin axle Dos ejes traseros, mas estabilidad/carga,
   vehiculo mas grande.
   rear_axles=2
4. Pesos, legalidad, carnet y homologacion
   La carga util es una variable critica: afecta a seguridad, legalidad, seguro, ITV y uso real. En autocaravanas, el payload es la
   diferencia entre la masa en orden de marcha y la masa maxima permitida, y todo lo que se anade cuenta: pasajeros, agua, gas,
   bicis, comida, accesorios y equipaje.
   Termino Definicion practica Por que importa Campo CRM
   MMA / MAM Masa maxima autorizada. Peso
   maximo legal cargado.
   Con carnet B normalmente el
   limite esta en 3.500 kg.
   mam_kg
   MTPLM Maximum Technically
   Permissible Laden Mass.
   Equivalente tecnico anglosajon
   de peso maximo cargado.
   No debe superarse. mtplm_kg
   MRO / MIRO Mass in Running Order. Peso
   del vehiculo en orden de
   marcha segun fabricante.
   Sirve para calcular carga util. miro_kg
   Tara Peso en vacio segun
   ficha/medicion.
   Base para estimar margen de
   carga.
   tare_kg
   Carga util / payload Peso disponible para personas,
   agua, equipaje y extras.
   Filtro critico para familias y
   overland.
   payload_kg
   Masa por eje Limite de peso en eje delantero
   y trasero.
   Portamotos, garaje y bola
   pueden sobrecargar eje
   trasero.
   front_axle_kg / rear_axle_kg
   MMC / GTW Masa maxima del conjunto
   vehiculo + remolque.
   Importa si lleva remolque, moto
   o barco.
   gross_train_weight_kg
   Homologacion vivienda Legalizacion de la
   camperizacion como vehiculo
   vivienda o autocaravana.
   Reduce riesgo de ITV/seguro. homologation_status
   Proyecto tecnico Documento tecnico para
   legalizar reformas.
   Clave en camperizaciones
   artesanales.
   technical_project_available
   Certificado de taller Certifica instalacion de
   reformas por taller autorizado.
   Necesario para ITV en
   reformas.
   workshop_certificate
   Informe de conformidad Documento de
   laboratorio/fabricante para
   reforma.
   Parte del expediente de
   homologacion.
   conformity_report
   Clasificacion ITV Codigo legal: turismo vivienda,
   furgon vivienda, autocaravana,
   etc.
   Afecta ITV, seguro y uso. itv_classification
   Etiqueta ambiental B, C, ECO, 0 o sin etiqueta. Importa para ZBE y ciudades. emissions_label
   Catalogo experto - Glosario tecnico de campers y autocaravanas
   Preparado para CRM de stock y preferencias de cliente
5. Distribuciones interiores y layouts
   Layout Descripcion Cliente ideal Campo CRM
   Rear fixed bed + garage Cama fija trasera elevada con
   garaje debajo.
   Parejas, viajes largos, bicis. floorplan=rear_fixed_bed_gara
   ge
   Rear lounge Salon trasero grande que se
   convierte en cama.
   Quien prioriza estar dentro y
   vistas.
   floorplan=rear_lounge
   Front lounge Salon delantero aprovechando
   asientos giratorios.
   Camper compacta y gran
   volumen.
   floorplan=front_lounge
   Face-to-face lounge Dos sofas enfrentados, salon
   moderno en autocaravanas.
   Parejas que priorizan amplitud. floorplan=face_to_face
   L-shaped lounge Salon en L con mesa central. Perfiladas/integrales clasicas. floorplan=l_lounge
   U-shaped rear lounge Salon trasero en U convertible. Vida interior, viajes largos. floorplan=u_rear_lounge
   Side galley Cocina lateral lineal. Gran volumen compacta. kitchen_layout=side_galley
   Rear kitchen Cocina en la parte trasera. Layouts tipo ocio/fin de
   semana.
   kitchen_layout=rear_kitchen
   Split bathroom Ducha a un lado y WC/lavabo
   al otro.
   Mayor confort sin bano enorme. bathroom_layout=split
   End washroom Bano grande en la parte
   trasera.
   Pareja senior, confort. bathroom_layout=rear_full
   Open plan Espacio abierto, pocos
   tabiques.
   Minimalistas, teletrabajo. floorplan=open_plan
   Modular Muebles/camas desmontables
   o reconfigurables.
   Uso diario + escapadas. floorplan=modular
6. Camas y zonas de descanso
   Tipo de cama Explicacion Busqueda real Campo CRM
   Cama transversal fija Cama doble colocada a lo
   ancho, tipica en furgon 5,99 m.
   cama fija, cama siempre hecha bed_layout=fixed_transverse
   Cama longitudinal fija Cama a lo largo, mas comoda
   para personas altas.
   cama larga, mido 1,90 bed_layout=fixed_longitudinal
   Camas gemelas Dos camas individuales
   longitudinales.
   camas separadas, twin beds bed_layout=twin_beds
   Cama isla Cama central accesible por
   ambos lados.
   cama isla, cama premium bed_layout=island_bed
   Cama francesa Cama lateral doble,
   normalmente con bano junto a
   ella.
   cama francesa bed_layout=french_bed
   Cama basculante/elevable Cama que baja del techo sobre
   salon o cabina.
   cama elevable, cama electrica bed_layout=drop_down
   Cama en techo elevable Cama superior dentro del pop-
   top.
   cama arriba, techo elevable bed_layout=pop_top_bed
   Literas Camas individuales en vertical,
   familiares.
   literas para ninos bed_layout=bunk_beds
   Cama dinette Mesa/salon que se convierte en
   cama.
   cama salon bed_layout=dinette_bed
   Cama Murphy Cama abatible vertical que
   libera espacio.
   cama abatible moderna bed_layout=murphy
   Colchon Froli Sistema de muelles/platos bajo
   colchon para ventilacion y
   confort.
   cama comoda, Froli bed_support=froli
7. Banos, duchas y WC
   Termino Descripcion Sinónimos de cliente Campo CRM
   Sin bano No hay WC ni ducha interior. prefiero espacio, sin bano me
   vale
   bathroom_type=none
   Porta Potti / potty WC portatil quimico. potti, wc portatil toilet_type=portable
   Cassette WC WC fijo con cassette extraible,
   comun en autocaravanas.
   Thetford, cassette toilet_type=cassette
   Bano humedo / wet bath Ducha y WC comparten el bano completo compacto bathroom_type=wet_bath
   Catalogo experto - Glosario tecnico de campers y autocaravanas
   Preparado para CRM de stock y preferencias de cliente
   mismo espacio.
   Ducha separada Ducha independiente del
   WC/lavabo.
   ducha aparte shower_type=separate
   Split bathroom Ducha y WC en lados opuestos
   del pasillo.
   bano partido bathroom_type=split
   Bano seco / composting toilet WC sin agua/quimicos,
   separacion solidos/liquidos.
   wc seco, compost toilet toilet_type=composting
   SOG Ventilacion/extraccion para
   cassette WC que reduce
   olores.
   sin olores en wc wc_ventilation=sog
   Ducha exterior Toma de ducha fuera, util para
   playa, perro, bicis.
   ducha para surf/perro outdoor_shower=true
8. Cocina, gas y electrodomesticos
   Termino Descripcion Cliente lo pide como Campo CRM
   Cocina de gas Hornillo fijo de 1, 2 o 3 fuegos. dos fuegos, cocina normal stove_type=gas
   Induccion Placa electrica, exige
   bateria/inversor potentes.
   quiero cocinar sin gas stove_type=induction
   Cocina diesel Placa alimentada por gasoil,
   menos comun.
   sin gas, Wallas stove_type=diesel
   Nevera compresor Nevera 12V eficiente, habitual
   en camper.
   nevera de compresor fridge_type=compressor
   Nevera trivalente Funciona a gas, 12V y 230V. nevera gas/220 fridge_type=three_way
   Boiler Calienta agua para
   ducha/fregadero.
   agua caliente hot_water_system=boiler
   GLP Gas licuado recargable en
   estaciones.
   deposito GLP, Autogas gas_system=lpg
   Bombona Campingaz Bombona pequena y facil de
   cambiar.
   bombona azul gas_bottle=campingaz
   DuoControl Regulador que conmuta entre
   dos bombonas.
   dos bombonas automaticas gas_regulator=duocontrol
   SecuMotion/Crash Sensor Seguridad de gas en marcha. gas seguro conduciendo gas_safety_sensor=true
9. Sistema electrico, baterias y autonomia off-grid
   En CRM conviene distinguir entre "tiene placa" y "tiene autonomia real". La autonomia depende de bateria util, consumo, carga
   solar, carga por alternador, inversor, nevera, calefaccion, clima y habitos del usuario.
   Termino Definicion Nota comercial/tecnica Campo CRM
   Bateria auxiliar / vivienda Bateria que alimenta la parte
   camper, separada de la bateria
   motor.
   Base del sistema electrico. leisure_battery=true
   AGM Bateria plomo sellada;
   economica, pesada y menor
   descarga util.
   Buena para sistemas basicos. battery_type=agm
   Gel Plomo gelificado; robusta,
   descarga moderada.
   Menos habitual en setups
   modernos.
   battery_type=gel
   LiFePO4 / litio Litio hierro fosfato; mas ciclos,
   menos peso, mas descarga util.
   Muy demandado para off-grid. battery_type=lifepo4
   BMS Battery Management System;
   protege y gestiona bateria de
   litio.
   Clave para seguridad y
   diagnostico.
   bms_present=true
   Ah Amperios-hora; capacidad
   nominal a un voltaje dado.
   No comparar sin saber voltaje y
   descarga util.
   battery_ah
   Wh / kWh Energia real: voltios x
   amperios-hora.
   Mejor metrica para autonomia. battery_kwh
   Inversor Convierte 12V/24V DC a 230V
   AC.
   Para enchufes, portatil,
   pequenos electrodomesticos.
   inverter_watts
   Onda pura Inversor con senal adecuada
   para electronica sensible.
   Preferible a onda modificada. inverter_type=pure_sine
   Inversor-cargador Inversor + cargador desde
   230V en un equipo.
   Ej. Victron MultiPlus. inverter_charger=true
   Catalogo experto - Glosario tecnico de campers y autocaravanas
   Preparado para CRM de stock y preferencias de cliente
   MPPT Regulador solar eficiente que
   optimiza carga de placas.
   Mejor que PWM. solar_controller=mppt
   DC-DC / booster Cargador desde alternador a
   bateria auxiliar.
   Clave en vehiculos modernos
   Euro 6.
   dc_dc_charger_amps
   Toma exterior 230V Conexion a camping/red
   electrica.
   Hook-up. shore_power=true
   Monitor bateria Mide consumo, carga y SOC. Victron SmartShunt/BMV. battery_monitor=true
   Victron Marca premium en electrica
   camper/off-grid.
   Aporta confianza tecnica. electrical_brand=victron
   Starlink ready Preinstalacion o espacio para
   internet satelital.
   Nómadas digitales. starlink_ready=true
   Router 4G/5G Internet movil con antena
   externa.
   Teletrabajo en ruta. router_4g_5g=true
10. Agua, fontaneria y depositos
    Termino Descripcion Por que importa Campo CRM
    Deposito limpias Agua potable/uso de ducha y
    cocina.
    Autonomia real. fresh_water_l
    Deposito grises Agua usada de
    fregadero/ducha.
    Gestion de residuos. grey_water_l
    Deposito negras Residuos de WC. Depende de cassette, nautico o
    seco.
    black_water_system
    Depositos interiores Van dentro del habitaculo. Mejor para invierno. internal_tanks=true
    Depositos calefactados Evitan congelacion. Uso en nieve/invierno. heated_tanks=true
    Bomba sumergible Bomba sencilla dentro del
    deposito.
    Sistemas basicos. water_pump=submersible
    Bomba presurizada Bomba externa con presion
    constante.
    Mayor confort. water_pump=pressure
    Vaso de expansion Estabiliza presion y reduce
    pulsaciones.
    Detalle tecnico de calidad. expansion_vessel=true
    Sensores de nivel Indican nivel de agua
    limpia/gris.
    Comodidad y control. water_level_sensors=true
    Filtro de agua Filtrado para beber o proteger
    instalacion.
    Viaje largo/off-grid. water_filter=true
11. Calefaccion, climatizacion y uso en invierno
    Sistema Descripcion Busqueda real Campo CRM
    Calefaccion estacionaria diesel Calefaccion alimentada por
    gasoil del vehiculo o deposito
    propio.
    Webasto, Autoterm, Planar heating_type=diesel
    Truma Combi Sistema habitual en
    autocaravanas para calefaccion
    y agua caliente.
    Truma Combi 4/6 heating_type=truma_combi
    Calefaccion a gas Usa gas propano/butano/GLP. calefaccion gas heating_type=gas
    Calefaccion hidronica Sistema con circuito de liquido
    caliente.
    Alde, calefaccion premium heating_type=hydronic
    Boiler electrico/gas Agua caliente independiente. ducha caliente hot_water_system=boiler
    MaxxFan / roof fan Ventilador/extractor de techo. ventilador techo, MaxxAir roof_fan=true
    Aire acondicionado vivienda Climatizacion del habitaculo
    parado.
    aire atras, AC vivienda living_ac=true
    Winterized / preparado invierno Aislamiento, calefaccion,
    depositos protegidos.
    camper para invierno winterized=true
    Doble suelo Camara tecnica en
    autocaravanas premium.
    doble suelo calefactado double_floor=true
12. Aislamiento, construccion y materiales
    Termino Descripcion Lectura experta Campo CRM
    Catalogo experto - Glosario tecnico de campers y autocaravanas
    Preparado para CRM de stock y preferencias de cliente
    Kaiflex / Armaflex Aislamiento elastomerico
    adhesivo comun en furgos.
    Buen estandar camper. insulation_material=elastomeric
    XPS Panel rigido aislante. Buen aislamiento, rigido. insulation_material=xps
    Lana de oveja Aislamiento natural usado en
    camperizaciones.
    Atractivo eco. insulation_material=sheep_woo
    l
    Corcho Aislamiento natural y acustico. Eco/boho. insulation_material=cork
    Barrera de vapor Capa para controlar
    condensacion.
    Importante en invierno. vapor_barrier=true
    Puentes termicos Zonas donde se transmite
    frio/calor por metal.
    Riesgo condensacion. thermal_bridges_treated=true
    Insonorizacion butilo Material para reducir
    vibraciones de chapa.
    Confort acustico. sound_deadening=true
    Contrachapado fenolico Madera resistente para
    muebles/suelo.
    Durabilidad. furniture_material=phenolic_ply
    wood
    Contrachapado de abedul Ligero, fuerte y de calidad. Camper premium/artesanal. furniture_material=birch_plywo
    od
    HPL Laminado de alta presion para
    superficies.
    Resistente y facil limpiar. surface_material=hpl
    Cierres push-lock Cierres que evitan apertura en
    marcha.
    Detalle de calidad. cabinet_latches=push_lock
    Soft-close Bisagras/cajones con cierre
    amortiguado.
    Acabado premium. soft_close=true
13. Estilos de interior y acabados
    Estilo Como se ve Cliente lo dice como Campos CRM
    Nordico / escandinavo Madera clara, blanco, luminoso,
    limpio.
    madera clara, blanco, sencillo style=scandinavian; wood=light
    Japandi Minimalismo calido, tonos
    arena, orden visual.
    calmado, elegante, minimalista style=japandi
    Boho Ratán, fibras naturales, beige,
    textiles, plantas.
    rollo boho, ibicenco style=boho
    Rustico Madera visible, tonos tierra,
    cabana.
    madera, acogedora, rustica style=rustic
    Industrial Negro mate, metal, madera
    oscura, robusto.
    industrial, negro, metalico style=industrial
    Premium moderno Laminados lisos, LED indirecto,
    look yacht.
    moderna, de lujo, premium style=premium_modern
    Nautico Blancos, azules, inox, madera
    tipo barco.
    estilo barco, nautico style=nautical
    Adventure/overland Aluminio, negro, anclajes,
    exterior tecnico.
    aventurera, 4x4, robusta style=adventure
    Minimalista Pocos muebles, espacio
    abierto, funcional.
    simple, limpia, sin recargar style=minimalist
    Stealth Exterior discreto, interior
    funcional.
    que no parezca camper style=stealth
    Retro/vintage Westfalia clasica, colores
    crema, madera vieja.
    vintage, retro style=retro
    Tiny house Sensacion de casita: madera,
    cocina bonita, calidez.
    casita con ruedas style=tiny_house
    Acabado Opciones utiles para CRM
    Wood tone light_oak, bamboo, walnut, dark_wood, painted_white
    Cabinet color white, grey, black, olive_green, navy_blue, cream, natural_wood
    Worktop hpl, compact, wood, corian, laminate, stainless
    Floor vinyl, marine_floor, rubber, wood, composite
    Upholstery fabric, leatherette, leather, stain_resistant, waterproof
    Lighting warm_led, cold_led, indirect_led, reading_lights, ambient_led
    Hardware matte_black, stainless, chrome, brass
    Catalogo experto - Glosario tecnico de campers y autocaravanas
    Preparado para CRM de stock y preferencias de cliente
14. Exterior, toldos, portabicis y equipamiento
    Termino Descripcion Uso comercial Campo CRM
    Toldo Fiamma/Thule u otros para
    sombra exterior.
    Muy valorado para verano. awning=true
    Avance Estructura/toldo cerrado
    exterior.
    Estancias largas en camping. driveaway_awning=true
    Portabicis Soporte trasero o de bola. Parejas/familias activas. bike_rack=true
    Portae-bikes Portabicis reforzado para bicis
    electricas.
    Peso y carga util. ebike_rack=true
    Bola de remolque Enganche para
    remolque/portamotos/portabicis
    .
    Carga extra. tow_bar=true
    Baca Estructura de techo para
    carga/placas.
    Surf/overland. roof_rack=true
    Escalera trasera Acceso al techo. Overland y mantenimiento. rear_ladder=true
    Oscurecedores Privacidad y aislamiento
    cabina.
    Dormir mejor, menos calor/frio. blackout_blinds=true
    Mosquiteras Ventanas/puertas con malla. Verano y naturaleza. mosquito_screens=true
    Cierres seguridad Heosafe/Thule/Fiamma en
    puertas.
    Miedo robo. security_locks=true
15. Off-road, overland y aventura
    Termino Descripcion Busqueda real Campo CRM
    4x4 / AWD Traccion total o conectable. Sprinter 4x4, Crafter 4Motion drive_type=4x4
    RWD Traccion trasera, buena para
    carga y pendientes.
    traccion trasera drive_type=rwd
    Neumaticos AT All Terrain: mejor en
    tierra/barro.
    BFGoodrich, General Grabber tyres=all_terrain
    Suspension reforzada Ballestas/muelles reforzados. mas alta, aguanta peso reinforced_suspension=true
    Suspension neumatica Mejora confort/nivelacion/carga. neumatica air_suspension=true
    Snorkel Entrada de aire elevada. overland serio snorkel=true
    Winch / cabrestante Sistema de rescate frontal. cabrestante winch=true
    Planchas desatasco Recovery boards para
    arena/barro.
    Maxtrax recovery_boards=true
    Toldo 270 grados Toldo envolvente de gran
    cobertura.
    toldo overland awning_270=true
    Rueda repuesto exterior Portarueda trasero. rueda fuera spare_wheel_carrier=true
16. Almacenamiento, garaje y material deportivo
    Necesidad Solucion de vehiculo Campo CRM
    Bicis dentro Garaje alto bajo cama fija o pasillo tecnico. interior_bike_storage=true
    E-bikes Portabicis reforzado o garaje + carga util
    suficiente.
    ebike_storage=true; payload_check=true
    Tabla de surf/SUP Baca, garaje largo o interior modular. surfboard_storage=true
    Esquis/snowboard Garaje pasante o armario largo. ski_storage=true
    Moto pequena Garaje grande, portamotos o remolque. motorbike_storage=true
    Perro grande Suelo resistente, ventilacion, espacio libre. pet_space=large
    Carrito bebe Garaje o maletero accesible. stroller_storage=true
    Ropa larga estancia Armarios altos y altillos. wardrobe_capacity=high
    Herramientas/equipo Garaje tecnico con anclajes. tool_storage=true
    Dron/camaras Cajones seguros, enchufes, inversor. camera_gear_storage=true
17. Conduccion, seguridad y cabina
    Elemento Descripcion Por que vende Campo CRM
    Cambio automatico Transmision automatica. Muy demandado en premium y gearbox=automatic
    Catalogo experto - Glosario tecnico de campers y autocaravanas
    Preparado para CRM de stock y preferencias de cliente
    vehiculos grandes.
    Control de crucero Mantiene velocidad. Viajes largos. cruise_control=true
    Camara trasera Ayuda a maniobrar. Reduce miedo de novatos. rear_camera=true
    Sensores parking Aviso distancia. Ciudad y maniobras. parking_sensors=true
    Camara 360 Vision perimetral. Premium. camera_360=true
    CarPlay/Android Auto Conectividad smartphone. Uso diario y rutas. carplay_androidauto=true
    Asientos giratorios Cabina se integra en salon. Aumenta espacio interior. swivel_seats=true
    Isofix Anclajes infantiles. Familias. isofix=true
    Alarma/localizador Seguridad antirrobo. Miedo a robo. alarm=true; gps_tracker=true
    ADAS Ayudas: frenada, carril, angulo
    muerto.
    Vehiculo moderno. adas_features=list
18. Marcas, fabricantes y componentes
    Categoria Nombres que conviene reconocer en CRM
    Fabricantes autocaravana/camper Hymer, Adria, Knaus, Weinsberg, Benimar, Challenger, Burstner,
    Dethleffs, Sunlight, Carado, McLouis, Rapido, Pilote, Etrusco,
    Laika, Carthago, Frankia, Hobby, Roller Team, Rimor, Dreamer,
    Possl, Globecar, Westfalia
    Modelos factory camper Volkswagen California, Mercedes Marco Polo, Ford Nugget,
    Westfalia James Cook, Possl Summit, Globecar Campscout,
    Hymer Grand Canyon
    Electrica Victron, Votronic, Renogy, CBE, Schaudt, EcoFlow, Bluetti,
    Liontron
    Calefaccion/clima Truma, Webasto, Autoterm, Planar, Alde, MaxxAir, Dometic
    WC/agua Thetford, Dometic, Fiamma, Shurflo, Whale, SOG
    Exterior/accesorios Fiamma, Thule, Reimo, Carbest, Heosafe, BFGoodrich, Maxtrax
    Ventanas/claraboyas Dometic Seitz, Polyplastic, Carbest, Fiamma, MaxxAir
19. Frases reales de busqueda y equivalencias CRM
    Frase del cliente Interpretacion experta Campos a activar
    Quiero estar varios dias sin camping. Busca autonomia real off-grid. off_grid_days, lithium, solar_w, water_l,
    toilet_type
    Quiero poder usar secador/cafetera. Necesita inversor potente y bateria
    adecuada.
    inverter_w >= 2000, battery_kwh
    Que entre en parking. Altura normalmente inferior a 2 m. max_height_m <= 2.0, compact_camper
    Cama siempre hecha. No quiere cama convertible diaria. fixed_bed_required=true
    Para viajar con ninos. Plazas, camas, Isofix y almacenamiento. travel_seats, sleeping_places, isofix,
    storage
    No quiero problemas de ITV. Homologacion/documentacion obligatoria. homologated=true,
    documents_available=true
    Quiero algo que no parezca camper. Stealth/discreta. style=stealth, exterior_discreet=true
    Voy a teletrabajar. Energia, mesa, conectividad, clima. desk_area, router, battery, heating, fan
    Llevo bicis electricas. Carga util + portabicis reforzado. ebike_rack, payload_kg, rear_axle_check
    Quiero 4x4 pero comoda. Overland premium, no solo estetica. drive_type=4x4, insulation, heating, water,
    payload
    Mi pareja mide 1,90. Cama longitudinal o cama larga. bed_length_cm >= 195
    La quiero para invierno. Aislamiento, calefaccion y depositos
    protegidos.
    winterized, diesel_heater/truma,
    heated_tanks
20. Taxonomia recomendada para CRM
    Usa campos estructurados y multi-selects. Evita guardar todo como texto libre: el texto ayuda a ventas, pero el matching necesita
    datos normalizados.
    Bloque CRM Campos recomendados
    Identidad del lead name, phone, email, location, lead_source, decision_stage,
    buying_timeline
    Catalogo experto - Glosario tecnico de campers y autocaravanas
    Preparado para CRM de stock y preferencias de cliente
    Presupuesto budget_min, budget_max, financing_needed,
    monthly_payment_target, trade_in_vehicle
    Uso primary_use_case, trip_duration, season_usage, camping_usage,
    remote_work, pets, sports_equipment
    Vehiculo vehicle_category, base_vehicle, body_code, length_m, height_m,
    drive_type, gearbox
    Plazas travel_seats_required, sleeping_places_required, is_family, kids,
    isofix_required
    Distribucion floorplan_preference, bed_layout, fixed_bed_required,
    bathroom_required, garage_required
    Autonomia off_grid_days_target, battery_type, battery_kwh, solar_w,
    inverter_w, dc_dc_charger, shore_power
    Agua/clima fresh_water_l, grey_water_l, hot_water, heating_type, living_ac,
    winterized
    Legal/peso license_type, max_mam_kg, payload_required,
    homologation_required, emissions_label_min
    Estilo interior_style, wood_tone, cabinet_color, exterior_style,
    premium_finish
    Deal breakers deal_breakers, must_haves, nice_to_haves, flexibility_budget,
    flexibility_layout
21. Reglas de matching y scoring
    Regla dura Accion
    Presupuesto maximo < precio y no hay flexibilidad Descartar o marcar fuera de presupuesto
    Plazas viaje requeridas > plazas homologadas Descartar
    Plazas dormir requeridas > plazas dormir Descartar
    Bano obligatorio y vehiculo sin WC/bano Descartar
    Carnet B y MMA > 3.500 kg Descartar o advertir carnet C/C1
    Altura maxima parking < altura vehiculo Descartar
    Homologacion obligatoria y sin documentacion Descartar
    Uso invierno y sin calefaccion/aislamiento Penalizar fuerte
    E-bikes o moto y payload bajo Advertir carga util/eje trasero
    Bloque de score Peso sugerido
    Presupuesto y financiacion 20%
    Tipo/base/dimensiones 10%
    Plazas viaje/dormir 15%
    Distribucion, cama y bano 20%
    Autonomia electrica/agua/clima 12%
    Legalidad, carnet y peso 10%
    Almacenamiento/deporte/exterior 5%
    Estilo interior/acabados 5%
    Marca, garantia y confianza 3%
    Ejemplo de explicacion automatica del CRM:
    "Esta Ducato L3H2 encaja porque tiene bano completo, cama transversal fija, 4 plazas homologadas,
    placa solar de 300 W, litio, calefaccion diesel y garaje para bicis. La principal renuncia es su longitud
    de 6,36 m, menos comoda para ciudad."
22. Checklist de alta de stock
    Area Datos a capturar siempre
    Identificacion Marca, modelo, ano, km, matricula interna, precio, garantia,
    ubicacion
    Base Base vehiculo, motor, potencia, cambio, traccion, etiqueta, L/H,
    largo/alto/ancho
    Legal MMA, tara, carga util, clasificacion ITV, homologacion, fecha ITV,
    documentos
    Catalogo experto - Glosario tecnico de campers y autocaravanas
    Preparado para CRM de stock y preferencias de cliente
    Plazas Plazas homologadas viaje, plazas dormir, Isofix, cinturones
    Layout Tipo de cama, salon, cocina, bano, garaje, altura interior
    Electrica Tipo bateria, Ah/kWh, solar W, inversor W, DC-DC, 230V, monitor
    bateria
    Agua/gas Depositos, bomba, agua caliente, WC, ducha, gas/GLP
    Clima Calefaccion, A/C, ventilador, aislamiento, preparado invierno
    Exterior Toldo, portabicis, baca, bola, cierres, mosquiteras, oscurecedores
    Estado Mantenimiento, neumaticos, revisiones, danos, humedad, prueba
    estanqueidad
    Estilo Estilo interior, colores, materiales, acabado percibido, fotos clave
    Cliente ideal Pareja, familia, surf, teletrabajo, invierno, overland, primera
    compra
23. Fuentes consultadas y notas de criterio
    El glosario combina experiencia de producto/CRM con terminologia sectorial comun. Para validar conceptos de layout, payload,
    pesos y electrica se han consultado fuentes especializadas y guias de fabricantes/distribuidores.
    Fuente Utilidad
    Carado - Buying a motorhome checklist Criterios de layout, cama, bano, almacenaje, payload y uso diario.
    Coachman - MRO, MTPLM and User Payload Definiciones de MRO, MTPLM y user payload.
    Brownhills - Motorhome Weight & Licence Guide Relaciones entre licencia, MAM/MIRO/payload y limites.
    Out & About Live - Motorhome weights and payloads Equivalencias GVW, MTPLM, MAM, MGVW y explicacion de
    peso.
    FarOutRide - Camper van electrical system Conceptos de electrica camper: baterias, carga, solar e inversor.
    Nohma - Campervan electrical system guide Inversores, 12V/230V y sistema electrico camper.
    CamperPals - Electrical systems for campervan DC-DC charging, MPPT y carga desde alternador.
    Roamworthy - Motorhome layout glossary Terminologia de distribuciones y camas.
