do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('noc_private.api(text,jsonb)'::regprocedure);
 if strpos(definition,'provider in (''google'',''apple'')')=0 then raise exception 'Expected provider guard was not found';end if;
 definition:=replace(definition,'provider in (''google'',''apple'')','provider = ''google''');
 definition:=replace(definition,'구글 또는 애플 로그인이 필요해요.','구글 로그인이 필요해요.');
 execute definition;
end $migration$;