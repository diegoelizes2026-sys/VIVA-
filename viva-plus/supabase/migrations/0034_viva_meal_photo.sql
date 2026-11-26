-- VIVA+ Saúde: operação de crédito "Foto do prato" (IA estima alimentos e calorias por foto).
-- Usa o recurso 'photo' do motor de créditos: no plano Free entra nas amostras grátis de foto do mês.
insert into public.viva_credit_operations(key,label,description,credits,pro_only,sort) values
 ('meal_photo','Foto do prato','Análise da foto da refeição: alimentos, porções, calorias e macros.',2,false,85)
on conflict (key) do nothing;
