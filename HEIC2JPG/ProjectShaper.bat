@echo off
rem 色々消す
title ProjectShaper
rem 条件分岐
set /p pushKey="VSProjectをシェイプアップします。よろしいですか？(y/n)"
if "%pushkey%" == "y" goto KILL
if "%pushkey%" == "Y" goto KILL
if "%pushkey%" == "yes" goto KILL
if "%pushkey%" == "YES" goto KILL

rem NO -> EXT

goto EXT

rem Delete for Folder and object
:KILL
rem Debug or debug
for /r %%A in ( debug ) do ( if exist "%%A" ( rmdir /s /q "%%A"))
for /r %%B in ( release ) do ( if exist "%%B" ( rmdir /s /q "%%B"))
for /r %%C in ( ipch ) do ( if exist "%%C" ( rmdir /s /q "%%C"))
for /r %%D in ( obj ) do ( if exist "%%D" ( rmdir /s /q "%%D"))
for /r %%E in ( *.suo ) do ( if exist "%%E" ( del /s /q "%%E"))
for /r %%F in ( *.user ) do ( if exist "%%F" ( del /s /q "%%F"))
rem for /r %%G in ( *.sdf ) do ( if exist "%%G" ( del /s /q "%%G"))
for /r %%H in ( *.bak ) do ( if exist "%%H" ( del /s /q "%%H"))
for /r %%I in ( *.vcproj ) do ( if exist "%%I" ( del /s /q "%%I"))
for /r %%J in ( _UpgradeReport_File ) do ( if exist "%%J" ( rmdir /s /q "%%J"))
for /r %%L in ( *.ncb ) do ( if exist "%%L" ( del /s /q "%%L"))
for /r %%M in ( *.opensdf ) do ( if exist "%%M" ( del /s /q "%%M"))
for /r %%N in ( Thumbs.db ) do ( if exist "%%N" ( del /s /q "%%N"))
for /r %%O in ( *~ ) do ( if exist "%%O" ( del /s /q "%%O"))
for /r %%P in ( packages ) do ( if exist "%%P" ( rmdir /s /q "%%P"))
for /r %%Q in ( bin ) do ( if exist "%%Q" ( rmdir /s /q "%%Q"))
for /r %%R in ( .vs ) do ( if exist "%%R" ( rmdir /s /q "%%R"))
for /r %%S in ( publish ) do ( if exist "%%S" ( rmdir /s /q "%%S"))
goto EXT


:EXT